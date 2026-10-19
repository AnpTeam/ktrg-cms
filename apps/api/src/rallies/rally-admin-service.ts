import type { ErrorCode } from "../lib/api-errors";
import type { RallyAdminStore, RallyCourse, RallyDetail, RallyFields, RallyKind, RallyPlace, RallyRow } from "./rally-admin-types";

type Result<T> = { ok: true; value: T } | { ok: false; reason: ErrorCode };
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const bad = (reason: ErrorCode): Result<never> => ({ ok: false, reason });

export type RallyAdminService = ReturnType<typeof createRallyAdminService>;

/**
 * The rules of the rally admin:
 * - a rally is made of places or of courses, chosen at creation and never changed;
 * - the Japanese name is required (English may be cleared);
 * - a rally of places holds stamp places only, each once; a rally of courses holds courses, each once;
 * - a rally with nothing in it cannot be published, and a published rally cannot be emptied (it could never be
 *   finished);
 * - deleting a rally removes visitors' finishes of it, never their stamps or course finishes.
 */
export function createRallyAdminService(deps: { store: RallyAdminStore }) {
  const { store } = deps;
  const date = (d: Date | string) => (d instanceof Date ? d : new Date(d));
  const trimmedEn = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
  const done = (r: RallyRow | "conflict" | null): Result<RallyRow> => (r === null ? bad("not_found") : r === "conflict" ? bad("conflict") : ok(r));
  /** Each once, and each one a stamp place (a rally of places) or a course (a rally of courses). */
  async function allowedMembers(kind: RallyKind, ids: string[]): Promise<boolean> {
    if (new Set(ids).size !== ids.length) return false;
    if (ids.length === 0) return true;
    const allowed = new Set(kind === "places" ? (await store.candidatePlaces()).map((p) => p.spotId) : (await store.candidateCourses()).map((c) => c.routeId));
    return ids.every((id) => allowed.has(id));
  }

  return {
    listRallies: () => store.listRallies(),

    async getRally(id: string): Promise<(RallyDetail & { candidates: RallyPlace[] | RallyCourse[] }) | null> {
      const found = await store.getRally(id);
      if (!found) return null;
      const candidates = found.rally.kind === "places" ? await store.candidatePlaces() : await store.candidateCourses();
      return { ...found, candidates };
    },

    /** Everything a new rally of this type may hold, for the new-rally form (all stamp places, or all courses). */
    candidates: (kind: RallyKind) => (kind === "places" ? store.candidatePlaces() : store.candidateCourses()),

    /**
     * A new rally with the members picked in the form, saved at once. Place ids for a rally of places, course ids for
     * a rally of courses; the other list must be empty.
     */
    async createRally(
      actor: string,
      input: { kind: RallyKind; nameJa: string; nameEn?: string | null; spotIds?: string[]; routeIds?: string[] },
    ): Promise<Result<RallyRow>> {
      const nameJa = input.nameJa.trim();
      if (nameJa === "") return bad("validation_failed");
      const spotIds = input.spotIds ?? [];
      const routeIds = input.routeIds ?? [];
      const memberIds = input.kind === "places" ? spotIds : routeIds;
      if ((input.kind === "places" ? routeIds : spotIds).length > 0) return bad("invalid_rally_members");
      const checked = await allowedMembers(input.kind, memberIds);
      if (!checked) return bad("invalid_rally_members");
      return ok(await store.createRally(actor, { kind: input.kind, nameJa, nameEn: trimmedEn(input.nameEn) ?? null, memberIds }));
    },

    async updateRally(actor: string, id: string, expected: Date | string, input: Partial<RallyFields>): Promise<Result<RallyRow>> {
      const current = await store.getRally(id);
      if (!current) return bad("not_found");
      const changes: Partial<RallyFields> = {};
      if (input.nameJa !== undefined) {
        if (input.nameJa.trim() === "") return bad("validation_failed");
        changes.nameJa = input.nameJa.trim();
      }
      if (input.nameEn !== undefined) changes.nameEn = trimmedEn(input.nameEn) ?? null;
      if (input.published !== undefined) {
        if (input.published && current.rally.memberCount === 0) return bad("rally_empty");
        changes.published = input.published;
      }
      return done(await store.updateRally(actor, id, date(expected), changes));
    },

    async reorderRallies(actor: string, ids: string[]): Promise<Result<true>> {
      return (await store.reorderRallies(actor, ids)) ? ok(true) : bad("validation_failed");
    },

    async setPlaces(actor: string, id: string, expected: Date | string, spotIds: string[]): Promise<Result<RallyRow>> {
      const current = await store.getRally(id);
      if (!current) return bad("not_found");
      if (current.rally.kind !== "places" || !(await allowedMembers("places", spotIds))) return bad("invalid_rally_members");
      if (spotIds.length === 0 && current.rally.published) return bad("rally_empty");
      return done(await store.setPlaces(actor, id, date(expected), spotIds));
    },

    async setCourses(actor: string, id: string, expected: Date | string, routeIds: string[]): Promise<Result<RallyRow>> {
      const current = await store.getRally(id);
      if (!current) return bad("not_found");
      if (current.rally.kind !== "course" || !(await allowedMembers("course", routeIds))) return bad("invalid_rally_members");
      if (routeIds.length === 0 && current.rally.published) return bad("rally_empty");
      return done(await store.setCourses(actor, id, date(expected), routeIds));
    },

    async deleteRally(actor: string, id: string): Promise<Result<true>> {
      return (await store.deleteRally(actor, id)) === "ok" ? ok(true) : bad("not_found");
    },
  };
}
