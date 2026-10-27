import { Elysia, t } from "elysia";
import { fail } from "../auth/http";
import { publicCache } from "../lib/public-cache";
import type { ContentService } from "../content/content-service";
import type { RallyAdminService } from "./rally-admin-service";

/**
 * What visitors read about rallies. No login, published rallies only, in their order. A rally of places lists its
 * published stamp places; a rally of courses lists its courses, each with its published stamp places and their status (so
 * the page can tell, from the visitor's own stamps, how far along they are). Drafts are never named.
 *
 * Building the answer reads every rally and every course in it (dozens of queries), so it is kept for `ttlMs` (like the
 * public route list): a change in the admin shows after at most that long.
 */
export function rallyPublicRoutes(getServices: () => { rallyAdmin: RallyAdminService; content: ContentService }, ttlMs = 0) {
  const build = async () => {
    const { rallyAdmin, content } = getServices();
    const published = (await rallyAdmin.listRallies()).filter((r) => r.published).sort((a, b) => a.sortOrder - b.sortOrder);
    // All rallies at once (the connection pool lines the queries up): one after another took about 8 s when the answer was not kept.
    const rallies = (
      await Promise.all(
        published.map(async (r) => {
          const found = await rallyAdmin.getRally(r.id);
          if (!found) return null;
          const base = { id: r.id, nameJa: r.nameJa, nameEn: r.nameEn, sortOrder: r.sortOrder };
          if ("places" in found) {
            const places = found.places
              .filter((p) => p.published)
              .sort((a, b) => a.position - b.position)
              .map((p) => ({ id: p.spotId, routeId: p.routeId, nameJa: p.nameJa, nameEn: p.nameEn }));
            return { ...base, kind: "places" as const, places, courses: [] };
          }
          const courses = await Promise.all(
            [...found.courses]
              .sort((a, b) => a.position - b.position)
              .map(async (c) => {
                const route = await content.publicRoute(c.routeId);
                // The status travels with each place: a closed place that nobody stamped counts as done (rallies/progress.ts).
                return { routeId: c.routeId, nameJa: c.nameJa, nameEn: c.nameEn, spots: (route?.spots ?? []).map((s) => ({ id: s.id, status: s.status })) };
              }),
          );
          return { ...base, kind: "course" as const, places: [], courses };
        }),
      )
    ).flatMap((r) => (r ? [r] : []));
    return { ok: true as const, rallies };
  };

  /**
   * One published rally with what its own page needs: every stamp place with its checked position, radius and status (so a
   * visitor near one can stamp it from the rally page), the route to open on the map, a photo, and when it was last changed.
   * A place without a checked position is left out, like everywhere else. Null for a draft or a rally that is not there.
   */
  const buildOne = async (id: string) => {
    const { rallyAdmin, content } = getServices();
    const found = await rallyAdmin.getRally(id);
    if (!found || !found.rally.published) return null;
    const routeIds = "places" in found ? [...new Set(found.places.filter((p) => p.published).map((p) => p.routeId))] : found.courses.map((c) => c.routeId);
    const routes = new Map<string, NonNullable<Awaited<ReturnType<typeof content.publicRoute>>>>();
    for (const rid of routeIds) {
      const r = await content.publicRoute(rid);
      if (r) routes.set(rid, r);
    }
    const spotOf = (rid: string, spotId: string) => routes.get(rid)?.spots.find((s) => s.id === spotId);
    const stampPlace = (rid: string, s: NonNullable<ReturnType<typeof spotOf>>) => ({
      id: s.id,
      routeId: rid,
      nameJa: s.nameJa,
      nameEn: s.nameEn,
      status: s.status,
      radiusM: s.radiusM,
      lat: s.position ? s.position.lat : null,
      lng: s.position ? s.position.lng : null,
    });
    const places =
      "places" in found
        ? found.places
            .filter((p) => p.published)
            .sort((a, b) => a.position - b.position)
            .flatMap((p) => {
              const s = spotOf(p.routeId, p.spotId);
              return s ? [stampPlace(p.routeId, s)] : [];
            })
        : [...found.courses].sort((a, b) => a.position - b.position).flatMap((c) => (routes.get(c.routeId)?.spots ?? []).map((s) => stampPlace(c.routeId, s)));
    const courses = "courses" in found ? [...found.courses].sort((a, b) => a.position - b.position).map((c) => ({ routeId: c.routeId, nameJa: c.nameJa, nameEn: c.nameEn })) : [];
    const photoUrl = routeIds.map((rid) => routes.get(rid)?.route.photoUrl ?? null).find((u) => u !== null) ?? null;
    const photoCredit = routeIds.map((rid) => routes.get(rid)?.route).find((r) => r?.photoUrl)?.photoCredit ?? null;
    return {
      id: found.rally.id,
      kind: found.rally.kind,
      nameJa: found.rally.nameJa,
      nameEn: found.rally.nameEn,
      updatedAt: found.rally.updatedAt.toISOString(),
      photoUrl,
      photoCredit,
      places,
      courses,
    };
  };

  let kept: { at: number; value: ReturnType<typeof build> } | null = null;
  return new Elysia({ detail: { tags: ["Content"] } })
    .get(
      "/rallies/:id",
      async ({ params, set }) => {
        const rally = await buildOne(params.id);
        if (!rally) return fail(set, 404, "not_found");
        publicCache(set, 60);
        return { ok: true as const, rally };
      },
      { params: t.Object({ id: t.String({ format: "uuid" }) }), detail: { summary: "One published rally, with its places and their positions" } },
    )
    .get(
    "/rallies",
    () => {
      if (ttlMs > 0 && kept && Date.now() - kept.at < ttlMs) return kept.value;
      const value = build();
      if (ttlMs > 0) {
        kept = { at: Date.now(), value };
        value.catch(() => (kept = null)); // never keep a failure
      }
      return value;
    },
    { detail: { summary: "The published stamp rallies, with what is in each" } },
  );
}
