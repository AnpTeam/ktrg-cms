import { Elysia } from "elysia";
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
    const rallies = [];
    for (const r of published) {
      const found = await rallyAdmin.getRally(r.id);
      if (!found) continue;
      const base = { id: r.id, nameJa: r.nameJa, nameEn: r.nameEn, sortOrder: r.sortOrder };
      if ("places" in found) {
        const places = found.places
          .filter((p) => p.published)
          .sort((a, b) => a.position - b.position)
          .map((p) => ({ id: p.spotId, routeId: p.routeId, nameJa: p.nameJa, nameEn: p.nameEn }));
        rallies.push({ ...base, kind: "places" as const, places, courses: [] });
      } else {
        const courses = [];
        for (const c of [...found.courses].sort((a, b) => a.position - b.position)) {
          const route = await content.publicRoute(c.routeId);
          // The status travels with each place: a closed place that nobody stamped counts as done (rallies/progress.ts).
          courses.push({ routeId: c.routeId, nameJa: c.nameJa, nameEn: c.nameEn, spots: (route?.spots ?? []).map((s) => ({ id: s.id, status: s.status })) });
        }
        rallies.push({ ...base, kind: "course" as const, places: [], courses });
      }
    }
    return { ok: true as const, rallies };
  };

  let kept: { at: number; value: ReturnType<typeof build> } | null = null;
  return new Elysia({ detail: { tags: ["Content"] } }).get(
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
