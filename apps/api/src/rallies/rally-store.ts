import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import {
  courseCompletions,
  rallies,
  rallyCompletions,
  rallyRoutes,
  rallySpots,
  rallyTranslations,
  spots,
  stamps,
} from "../db/schema";
import { flattenTexts, RALLY_TEXT } from "../db/translations";
import { courseProgress, placeProgress, type CourseProgress, type HeldStamp, type PlaceMember, type PlaceProgress } from "./progress";

/** A database or a transaction: reading is all most of this needs. */
export type Reader = Pick<Db, "select">;
type Writer = Pick<Db, "select" | "insert">;

/**
 * Which rallies one place counts in, through the foreign keys:
 * - rallies of PLACES that list it (rally_spots.spot_id → spots.id), for example the sutra-mound rally;
 * - rallies of COURSES that hold its course (spots.route_id → rally_routes.route_id).
 * A sutra mound in two rallies of places, on a course that is in a third rally, is found in all three.
 */
export async function ralliesForPlace(q: Reader, spotId: string): Promise<{ routeId: string | null; rallyIds: string[] }> {
  const [place] = await q.select({ routeId: spots.routeId }).from(spots).where(eq(spots.id, spotId)).limit(1);
  if (!place) return { routeId: null, rallyIds: [] };
  const byPlace = await q.select({ id: rallySpots.rallyId }).from(rallySpots).where(eq(rallySpots.spotId, spotId));
  const byCourse = await q.select({ id: rallyRoutes.rallyId }).from(rallyRoutes).where(eq(rallyRoutes.routeId, place.routeId));
  return { routeId: place.routeId, rallyIds: [...new Set([...byPlace, ...byCourse].map((r) => r.id))] };
}

/** One visitor's stamps (revoked ones included; the progress rules ignore them). Only their own rows are read. */
const stampsOf = (q: Reader, userId: string): Promise<HeldStamp[]> =>
  q.select({ spotId: stamps.spotId, createdAt: stamps.createdAt, revokedAt: stamps.revokedAt }).from(stamps).where(eq(stamps.userId, userId));

/** The stamp places of these courses (navigation points never count), grouped by course. */
async function courseMembers(q: Reader, routeIds: readonly string[]): Promise<Map<string, PlaceMember[]>> {
  const out = new Map<string, PlaceMember[]>(routeIds.map((id) => [id, []]));
  if (routeIds.length === 0) return out;
  const rows = await q
    .select({ routeId: spots.routeId, spotId: spots.id, published: spots.published, status: spots.status })
    .from(spots)
    .where(and(inArray(spots.routeId, [...routeIds]), eq(spots.stampable, true)));
  for (const r of rows) out.get(r.routeId)!.push({ spotId: r.spotId, published: r.published, status: r.status });
  return out;
}

/** The places of these rallies of places, grouped by rally. */
async function placeMembers(q: Reader, rallyIds: readonly string[]): Promise<Map<string, PlaceMember[]>> {
  const out = new Map<string, PlaceMember[]>(rallyIds.map((id) => [id, []]));
  if (rallyIds.length === 0) return out;
  const rows = await q
    .select({ rallyId: rallySpots.rallyId, spotId: spots.id, published: spots.published, status: spots.status })
    .from(rallySpots)
    .innerJoin(spots, eq(spots.id, rallySpots.spotId))
    .where(and(inArray(rallySpots.rallyId, [...rallyIds]), eq(spots.stampable, true)))
    .orderBy(asc(rallySpots.position));
  for (const r of rows) out.get(r.rallyId)!.push({ spotId: r.spotId, published: r.published, status: r.status });
  return out;
}

/** The courses of these rallies of courses, grouped by rally, in order. */
async function routeMembers(q: Reader, rallyIds: readonly string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(rallyIds.map((id) => [id, []]));
  if (rallyIds.length === 0) return out;
  const rows = await q
    .select({ rallyId: rallyRoutes.rallyId, routeId: rallyRoutes.routeId })
    .from(rallyRoutes)
    .where(inArray(rallyRoutes.rallyId, [...rallyIds]))
    .orderBy(asc(rallyRoutes.position));
  for (const r of rows) out.get(r.rallyId)!.push(r.routeId);
  return out;
}

/**
 * Saves what a visitor has just finished: every course whose published stamp places are all stamped (or closed),
 * then every published rally that is now complete (its places, or all its courses). Rows are only ever added
 * (`ON CONFLICT DO NOTHING`), so a finish stays saved. With `spotId` only the course of that place and the rallies it
 * counts in are checked (after a stamp); without it, everything (when a visitor's progress is read).
 * Returns what was newly finished.
 */
export async function recordFinished(
  q: Writer,
  userId: string,
  opts: { spotId?: string; now?: Date } = {},
): Promise<{ routeIds: string[]; rallyIds: string[] }> {
  const at = opts.now ?? new Date();
  const held = await stampsOf(q, userId);

  // Which courses and rallies to look at.
  let routeIds: string[];
  let rallyRows: { id: string; kind: "places" | "course" }[];
  if (opts.spotId) {
    const touched = await ralliesForPlace(q, opts.spotId);
    routeIds = touched.routeId ? [touched.routeId] : [];
    rallyRows = touched.rallyIds.length
      ? await q.select({ id: rallies.id, kind: rallies.kind }).from(rallies).where(and(inArray(rallies.id, touched.rallyIds), eq(rallies.published, true)))
      : [];
  } else {
    routeIds = [...new Set((await q.select({ routeId: spots.routeId }).from(spots).where(eq(spots.stampable, true))).map((r) => r.routeId))];
    rallyRows = await q.select({ id: rallies.id, kind: rallies.kind }).from(rallies).where(eq(rallies.published, true));
  }

  // Courses first: a rally of courses needs to know which of its courses are finished.
  const saved = new Set((await q.select({ routeId: courseCompletions.routeId }).from(courseCompletions).where(eq(courseCompletions.userId, userId))).map((r) => r.routeId));
  const courseRallies = rallyRows.filter((r) => r.kind === "course").map((r) => r.id);
  const coursesOf = await routeMembers(q, courseRallies);
  // A rally of courses may hold courses beyond the touched one: all of them are looked at.
  const allRoutes = [...new Set([...routeIds, ...[...coursesOf.values()].flat()])];
  const members = await courseMembers(q, allRoutes);
  const newCourses = allRoutes.filter((id) => !saved.has(id) && placeProgress({ members: members.get(id) ?? [], stamps: held }).complete);
  if (newCourses.length) {
    await q.insert(courseCompletions).values(newCourses.map((routeId) => ({ userId, routeId, completedAt: at }))).onConflictDoNothing();
  }
  const finishedCourses = new Set([...saved, ...newCourses]);

  // Then rallies.
  const done = new Set((await q.select({ rallyId: rallyCompletions.rallyId }).from(rallyCompletions).where(eq(rallyCompletions.userId, userId))).map((r) => r.rallyId));
  const placeRallies = rallyRows.filter((r) => r.kind === "places").map((r) => r.id);
  const placesOf = await placeMembers(q, placeRallies);
  const newRallies = rallyRows
    .filter((r) => !done.has(r.id))
    .filter((r) =>
      r.kind === "places"
        ? placeProgress({ members: placesOf.get(r.id) ?? [], stamps: held }).complete
        : courseProgress({ routeIds: coursesOf.get(r.id) ?? [], finishedRouteIds: finishedCourses }).complete,
    )
    .map((r) => r.id);
  if (newRallies.length) {
    await q.insert(rallyCompletions).values(newRallies.map((rallyId) => ({ userId, rallyId, completedAt: at }))).onConflictDoNothing();
  }
  return { routeIds: newCourses, rallyIds: newRallies };
}

export type RallySummary = {
  id: string;
  kind: "places" | "course";
  nameJa: string;
  nameEn: string | null;
  sortOrder: number;
  /** When the visitor finished it; null if not (yet). A saved finish stands even if the rally grew since. */
  completedAt: Date | null;
} & ({ kind: "places"; progress: PlaceProgress } | { kind: "course"; progress: CourseProgress });

/**
 * Every published rally with one visitor's progress in it. Plain reads (no SQL string building), then the pure rules
 * in progress.ts decide; a course counts as finished when its finish is saved or it is finished right now.
 */
export async function listRalliesWithProgress(db: Reader, userId: string): Promise<RallySummary[]> {
  const all = await db.select().from(rallies).where(eq(rallies.published, true)).orderBy(asc(rallies.sortOrder));
  if (all.length === 0) return [];
  const ids = all.map((r) => r.id);
  const names = flattenTexts(RALLY_TEXT, await db.select().from(rallyTranslations).where(inArray(rallyTranslations.rallyId, ids)), (t) => t.rallyId);
  const held = await stampsOf(db, userId);
  const placesOf = await placeMembers(db, all.filter((r) => r.kind === "places").map((r) => r.id));
  const coursesOf = await routeMembers(db, all.filter((r) => r.kind === "course").map((r) => r.id));
  const routeIds = [...new Set([...coursesOf.values()].flat())];
  const members = await courseMembers(db, routeIds);
  const savedCourses = new Set(
    (await db.select({ routeId: courseCompletions.routeId }).from(courseCompletions).where(eq(courseCompletions.userId, userId))).map((r) => r.routeId),
  );
  const finished = new Set([...savedCourses, ...routeIds.filter((id) => placeProgress({ members: members.get(id) ?? [], stamps: held }).complete)]);
  const completions = new Map(
    (await db
      .select({ rallyId: rallyCompletions.rallyId, at: rallyCompletions.completedAt })
      .from(rallyCompletions)
      .where(and(eq(rallyCompletions.userId, userId), inArray(rallyCompletions.rallyId, ids)))).map((c) => [c.rallyId, c.at]),
  );

  return all.map((r) => {
    const base = { id: r.id, nameJa: names.get(r.id)?.nameJa ?? "", nameEn: names.get(r.id)?.nameEn ?? null, sortOrder: r.sortOrder, completedAt: completions.get(r.id) ?? null };
    return r.kind === "places"
      ? { ...base, kind: "places" as const, progress: placeProgress({ members: placesOf.get(r.id) ?? [], stamps: held }) }
      : { ...base, kind: "course" as const, progress: courseProgress({ routeIds: coursesOf.get(r.id) ?? [], finishedRouteIds: finished }) };
  });
}
