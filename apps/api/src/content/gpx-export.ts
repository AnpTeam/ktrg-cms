import { Elysia, t } from "elysia";
import { fail } from "../auth/http";
import { routeKit, type RouteOptions } from "../auth/route-kit";
import type { ContentServices } from "./admin-routes";
import type { LineString } from "./line";

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface GpxWaypoint {
  name: string;
  lat: number;
  lng: number;
}

/**
 * A GPX 1.1 file for a walker's own device: the checked route line as one track (with the elevation on every point that
 * has one) and the published places with a checked position as waypoints. No times: the line is a drawn path, not a walk.
 */
export function buildGpx(name: string, line: LineString, waypoints: readonly GpxWaypoint[]): string {
  const wpts = waypoints.map((w) => `  <wpt lat="${w.lat}" lon="${w.lng}"><name>${escapeXml(w.name)}</name></wpt>`);
  const pts = line.coordinates.map(([lng, lat, ele]) => `      <trkpt lat="${lat}" lon="${lng}">${ele === undefined ? "" : `<ele>${ele}</ele>`}</trkpt>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Katsuragi Shugen stamp rally" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${escapeXml(name)}</name></metadata>`,
    ...wpts,
    "  <trk>",
    `    <name>${escapeXml(name)}</name>`,
    "    <trkseg>",
    ...pts,
    "    </trkseg>",
    "  </trk>",
    "</gpx>",
    "",
  ].join("\n");
}

/** A file name that is safe in a header: ASCII letters and digits only, the route's own id keeps it unique. */
const fileName = (id: string) => `route-${id.replace(/[^0-9a-zA-Z-]/g, "")}.gpx`;

/**
 * The GPX download of a route. Signed-in only (any role): the line is the app's content, and a login keeps scripts from
 * pulling every route. A route whose line nobody has checked has none to give (404, like a draft).
 */
export function gpxExportRoutes(getServices: () => ContentServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  return new Elysia({ detail: { tags: ["Content"] } }).use(plugins).get(
    "/routes/:id/gpx",
    async ({ params, set }) => {
      const found = await getServices().content.publicRoute(params.id);
      if (!found?.route.line) return fail(set, 404, "not_found");
      const waypoints = found.spots.flatMap((s) => (s.position ? [{ name: s.nameJa, lat: s.position.lat, lng: s.position.lng }] : []));
      return new Response(buildGpx(found.route.nameJa, found.route.line, waypoints), {
        headers: { "content-type": "application/gpx+xml; charset=utf-8", "content-disposition": `attachment; filename="${fileName(params.id)}"`, "cache-control": "private, no-store" },
      });
    },
    { auth: "route.gpx", params: t.Object({ id: t.String({ format: "uuid" }) }) },
  );
}
