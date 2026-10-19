import { describe, expect, test } from "bun:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { users } from "./auth";
import {
  auditLog,
  courseCompletions,
  rallies,
  rallyCompletions,
  rallyRoutes,
  rallySpots,
  rallyTranslations,
  routes,
  routeTranslations,
  spotKinds,
  spots,
  spotTranslations,
  stamps,
  trailNotices,
  trailNoticeTranslations,
} from "./content";

type Table = Parameters<typeof getTableConfig>[0];
const cols = (t: Table) => getTableConfig(t).columns.map((c) => c.name);
const col = (t: Table, name: string) => getTableConfig(t).columns.find((c) => c.name === name)!;

describe("content schema", () => {
  test("table names", () => {
    const tables = [routes, spots, rallies, rallySpots, stamps, trailNotices, auditLog];
    expect(tables.map((t) => getTableConfig(t).name)).toEqual([
      "routes",
      "spots",
      "rallies",
      "rally_spots",
      "stamps",
      "trail_notices",
      "audit_log",
    ]);
  });

  test("stamps never store the phone's coordinates", () => {
    for (const name of ["lat", "lng", "latitude", "longitude"]) {
      expect(cols(stamps)).not.toContain(name);
    }
  });

  test("a user can collect each spot only once", () => {
    const idx = getTableConfig(stamps).indexes.find((i) => i.config.name === "stamps_user_spot_uq")!;
    expect(idx.config.unique).toBe(true);
    expect(idx.config.columns.map((c) => (c as { name: string }).name)).toEqual(["user_id", "spot_id"]);
  });

  test("spots start unpublished, without permission, and may lack coordinates", () => {
    expect(col(spots, "published").default).toBe(false);
    expect(col(spots, "permission_confirmed").default).toBe(false);
    expect(col(spots, "lat").notNull).toBe(false);
    expect(col(spots, "lng").notNull).toBe(false);
  });

  test("every spot belongs to a route", () => {
    expect(col(spots, "route_id").notNull).toBe(true);
  });

  test("spots guard publishing and coordinates with constraints", () => {
    const names = getTableConfig(spots).checks.map((c) => c.name);
    expect(names).toContain("spots_coordinates_together");
    expect(names).toContain("spots_publish_requires_coordinates");
    expect(names).toContain("spots_publish_requires_permission");
    expect(names).toContain("spots_publish_requires_verified_position");
  });

  test("routes have a history and an access text (per language) and a photo", () => {
    expect(col(routes, "photo_url").notNull).toBe(false);
    for (const c of ["history", "access"]) expect(col(routeTranslations, c).notNull).toBe(false);
  });

  test("a point is a stamp place unless it says otherwise; the other kinds are the route's own points and map categories", () => {
    expect(col(spots, "kind").default).toBe("stamp");
    expect(col(spots, "kind").notNull).toBe(true);
    expect(spotKinds[0]).toBe("stamp");
    for (const k of ["turn", "danger", "toilet", "rest_area", "drinking_water", "bus_stop"]) expect(spotKinds as readonly string[]).toContain(k);
    expect(col(spots, "photo_url").notNull).toBe(false);
  });

  test("a route line is a draft until a person checks it against a source", () => {
    expect(col(routes, "line_verified").notNull).toBe(true);
    expect(col(routes, "line_verified").default).toBe(false);
    expect(col(routes, "line_source").notNull).toBe(false);
  });

  test("a position is a draft until a person checks it against a source", () => {
    expect(col(spots, "position_verified").notNull).toBe(true);
    expect(col(spots, "position_verified").default).toBe(false);
    expect(col(spots, "position_source").notNull).toBe(false);
  });

  test("words live in a translation table, one row per owner and language, never as _ja/_en columns", () => {
    const owners = [
      [routes, routeTranslations, "route_id"],
      [spots, spotTranslations, "spot_id"],
      [rallies, rallyTranslations, "rally_id"],
      [trailNotices, trailNoticeTranslations, "trail_notice_id"],
    ] as const;
    for (const [owner, words, key] of owners) {
      expect(cols(owner).filter((c) => /_(ja|en)$/.test(c))).toEqual([]);
      const cfg = getTableConfig(words);
      expect(cfg.primaryKeys[0]!.columns.map((c) => c.name)).toEqual([key, "locale"]);
      expect(cfg.foreignKeys[0]!.reference().foreignTable).toBe(owner);
      expect(cfg.foreignKeys[0]!.onDelete).toBe("cascade");
      expect(col(words, "locale").enumValues).toEqual(["ja", "en"]);
    }
  });

  test("Japanese text is required, English is optional", () => {
    expect(getTableConfig(routeTranslations).checks.map((c) => c.name)).toEqual(["route_translations_ja_name"]);
    expect(getTableConfig(spotTranslations).checks.map((c) => c.name)).toEqual(["spot_translations_ja_name"]);
    expect(getTableConfig(rallyTranslations).checks.map((c) => c.name)).toEqual(["rally_translations_ja_name"]);
    expect(getTableConfig(trailNoticeTranslations).checks.map((c) => c.name)).toEqual(["trail_notice_translations_ja_body"]);
  });

  test("a rally is made of places or of courses, and is a draft until published; no N-of-M rule and no dates", () => {
    expect(col(rallies, "kind").notNull).toBe(true);
    expect(col(rallies, "published").notNull).toBe(true);
    expect(cols(rallies)).not.toContain("stamps_required");
    expect(cols(rallies)).not.toContain("route_id");
    expect(cols(rallies)).not.toContain("starts_at");
    expect(getTableConfig(rallies).indexes).toHaveLength(0); // any number of rallies of either kind
  });

  test("a rally of courses lists courses by foreign key, keyed by both, findable from the course", () => {
    const cfg = getTableConfig(rallyRoutes);
    expect(cfg.primaryKeys[0]!.columns.map((c) => c.name)).toEqual(["rally_id", "route_id"]);
    expect(cfg.foreignKeys.map((f) => f.reference().foreignTable)).toEqual([rallies, routes]);
    expect(cfg.indexes.map((i) => i.config.name)).toContain("rally_routes_route_idx");
  });

  test("finishes are saved once per visitor: a course, and a rally", () => {
    expect(getTableConfig(courseCompletions).primaryKeys[0]!.columns.map((c) => c.name)).toEqual(["user_id", "route_id"]);
    expect(getTableConfig(rallyCompletions).primaryKeys[0]!.columns.map((c) => c.name)).toEqual(["user_id", "rally_id"]);
    expect(col(rallyCompletions, "completed_at").notNull).toBe(true);
  });

  test("a place can be in many rallies: the link table is keyed by both and never stores stamps", () => {
    const cfg = getTableConfig(rallySpots);
    expect(cfg.primaryKeys[0]!.columns.map((c) => c.name)).toEqual(["rally_id", "spot_id"]);
    expect(cols(rallySpots)).not.toContain("user_id"); // progress is computed from stamps, not stored per rally
    expect(cfg.indexes.map((i) => i.config.name)).toContain("rally_spots_spot_idx");
    for (const fk of cfg.foreignKeys) expect(fk.onDelete).toBe("cascade");
  });

  test("trail notices need an official source and a verified date", () => {
    expect(col(trailNotices, "source_url").notNull).toBe(true);
    expect(col(trailNotices, "verified_at").notNull).toBe(true);
  });

  test("audit log keeps its rows when the actor is deleted", () => {
    const fk = getTableConfig(auditLog).foreignKeys[0]!;
    expect(fk.reference().foreignTable).toBe(users);
    expect(fk.onDelete).toBe("set null");
  });

  test("a spot that has stamps cannot be deleted", () => {
    const fk = getTableConfig(stamps).foreignKeys.find((f) => f.reference().foreignTable === spots)!;
    expect(fk.onDelete).toBe("restrict");
  });
});
