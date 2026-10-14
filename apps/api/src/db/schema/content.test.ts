import { describe, expect, test } from "bun:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { auditLog, rallies, routes, spots, stamps, trailNotices } from "./content";

type Table = Parameters<typeof getTableConfig>[0];
const cols = (t: Table) => getTableConfig(t).columns.map((c) => c.name);
const col = (t: Table, name: string) => getTableConfig(t).columns.find((c) => c.name === name)!;

describe("content schema", () => {
  test("table names", () => {
    const tables = [rallies, routes, spots, stamps, trailNotices, auditLog];
    expect(tables.map((t) => getTableConfig(t).name)).toEqual([
      "rallies",
      "routes",
      "spots",
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
  });

  test("Japanese text is required, English is optional", () => {
    for (const t of [routes, spots]) {
      expect(col(t, "name_ja").notNull).toBe(true);
      expect(col(t, "name_en").notNull).toBe(false);
    }
    expect(col(trailNotices, "body_ja").notNull).toBe(true);
    expect(col(trailNotices, "body_en").notNull).toBe(false);
  });

  test("a rally with no stampsRequired means every published spot", () => {
    expect(col(rallies, "stamps_required").notNull).toBe(false);
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
