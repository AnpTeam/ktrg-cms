import { Elysia, t } from "elysia";
import { fail } from "../auth/http";
import { routeKit, type RouteOptions } from "../auth/route-kit";
import type { RoutingService } from "../routing/routing-service";
import type { StampServices } from "../stamps/stamp-routes";

export interface NavigationServices extends StampServices {
  /** The routing service held to visitors' share of the day (services.ts). */
  navigationRouting: RoutingService;
}

/**
 * A walking path for a visitor who is off the course line (navigation on the map page). Signed-in only, rate limited
 * per user (the OpenRouteService allowance is shared by everyone). The visitor's position is used for this one call
 * to OpenRouteService and then dropped: it is never stored or logged (routing-service.ts logs nothing either).
 * The destination is the stamp place itself, looked up here, so a caller cannot route to any point it likes.
 */
export function navigationRoutes(getServices: () => NavigationServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);

  return new Elysia({ prefix: "/navigation", detail: { tags: ["Navigation"] } }).use(plugins).post(
    "/path",
    async ({ body, set }) => {
      const place = await getServices().stamps.stampPlace(body.spotId);
      if (!place) return fail(set, 404, "not_found");
      const r = await getServices().navigationRouting.snap([{ lat: body.lat, lng: body.lng }, { lat: place.lat, lng: place.lng }]);
      if (r.ok) return { ok: true as const, line: r.line, distanceM: r.distanceM };
      return fail(set, r.reason === "routing_unavailable" ? 503 : r.reason === "routing_no_route" ? 422 : 502, r.reason);
    },
    {
      auth: "navigation.path",
      rateLimit: { navigationPathUser: "user.id", navigationPathDaily: "user.id" },
      body: t.Object({
        spotId: t.String({ format: "uuid" }),
        lat: t.Number({ minimum: -90, maximum: 90 }),
        lng: t.Number({ minimum: -180, maximum: 180 }),
      }),
    },
  );
}
