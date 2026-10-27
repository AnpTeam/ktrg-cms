import { publicCache } from "../lib/public-cache";
import { createHash } from "node:crypto";
import { Elysia, t } from "elysia";
import { fail } from "../auth/http";
import type { ContentService, PublicSpot } from "./content-service";

const spotOut = (s: PublicSpot) => ({ ...s, statusUpdatedAt: s.statusUpdatedAt ? s.statusUpdatedAt.toISOString() : null });
const idParams = t.Object({ id: t.String({ format: "uuid" }) });

/**
 * What visitors read. No login. All routes are listed (the ones without a published place are "soon");
 * a place appears only when published, and its position only when a person has checked it.
 * A draft place answers 404, exactly like one that does not exist.
 */
export function publicContentRoutes(getContent: () => ContentService) {
  return new Elysia({ detail: { tags: ["Content"] } })
    .get("/routes", async ({ set }) => {
      publicCache(set);
      return { ok: true as const, routes: await getContent().publicRoutes() };
    })
    .get(
      "/routes/:id",
      async ({ params, set }) => {
        const found = await getContent().publicRoute(params.id);
        if (found) publicCache(set);
        return found ? { ok: true as const, route: found.route, spots: found.spots.map(spotOut), points: found.points.map(spotOut) } : fail(set, 404, "not_found");
      },
      { params: idParams },
    )
    .get("/spots/status", async ({ headers }) => {
      const spots = (await getContent().publicSpotStatuses())
        .sort((a, b) => (a.id < b.id ? -1 : 1)) // same data, same ETag
        .map((s) => ({ ...s, statusUpdatedAt: s.statusUpdatedAt ? s.statusUpdatedAt.toISOString() : null }));
      const body = JSON.stringify({ ok: true, spots });
      const etag = `"${createHash("sha1").update(body).digest("base64url")}"`;
      // no-cache: the browser keeps the copy but asks again every time, and gets a 304 when nothing changed.
      const h = { etag, "cache-control": "no-cache", "content-type": "application/json" };
      return headers["if-none-match"] === etag ? new Response(null, { status: 304, headers: h }) : new Response(body, { headers: h });
    })
    .get(
      "/spots/:id",
      async ({ params, set }) => {
        const spot = await getContent().publicSpot(params.id);
        return spot ? { ok: true as const, spot: spotOut(spot) } : fail(set, 404, "not_found");
      },
      { params: idParams },
    );
}
