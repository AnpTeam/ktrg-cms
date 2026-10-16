import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// Table definitions follow section 9.4 of the system design document.

export const spotStatus = pgEnum("spot_status", ["open", "caution", "closed"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/**
 * A trail route (19 of them). Japanese is required, English falls back to it.
 * Most fields are nullable so routes can be seeded as skeletons and filled in
 * through the CMS.
 */
export const routes = pgTable(
  "routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nameJa: text("name_ja").notNull(),
    nameEn: text("name_en"),
    descriptionJa: text("description_ja"),
    descriptionEn: text("description_en"),
    distanceKm: numeric("distance_km", { precision: 6, scale: 2, mode: "number" }),
    elevationGainM: integer("elevation_gain_m"),
    difficulty: text("difficulty"),
    expectedTimeMin: integer("expected_time_min"),
    // Osaka, Wakayama or Nara (validated in the API).
    prefecture: text("prefecture"),
    municipality: text("municipality"),
    // GeoJSON line drawn on the map.
    geometry: jsonb("geometry"),
    // YouTube / Vimeo only; the host is checked in the API.
    videoUrl: text("video_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("routes_distance_nonneg", sql`${t.distanceKm} is null or ${t.distanceKm} >= 0`),
    check("routes_time_nonneg", sql`${t.expectedTimeMin} is null or ${t.expectedTimeMin} >= 0`),
  ],
);

/**
 * A sutra mound (31 places: 28 numbers, three of them with two places), the place a stamp is collected. Each belongs to
 * one route (an assumption in the design doc; a join table if that changes).
 * Seeded as drafts without coordinates: coordinates are never guessed.
 */
export const spots = pgTable(
  "spots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routeId: uuid("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "restrict" }),
    nameJa: text("name_ja").notNull(),
    nameEn: text("name_en"),
    descriptionJa: text("description_ja"),
    descriptionEn: text("description_en"),
    // Entered by an admin from an official source.
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    // Check-in radius in metres.
    radiusM: integer("radius_m").notNull().default(50),
    status: spotStatus("status").notNull().default("open"),
    statusNoteJa: text("status_note_ja"),
    statusNoteEn: text("status_note_en"),
    statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true }),
    // Order within the route (the design doc does not specify one).
    sortOrder: integer("sort_order").notNull().default(0),
    published: boolean("published").notNull().default(false),
    permissionConfirmed: boolean("permission_confirmed").notNull().default(false),
    // Who granted permission.
    permissionNote: text("permission_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("spots_route_idx").on(t.routeId, t.sortOrder),
    check("spots_lat_range", sql`${t.lat} is null or ${t.lat} between -90 and 90`),
    check("spots_lng_range", sql`${t.lng} is null or ${t.lng} between -180 and 180`),
    check("spots_coordinates_together", sql`(${t.lat} is null) = (${t.lng} is null)`),
    check("spots_radius_positive", sql`${t.radiusM} > 0`),
    // Only publish with coordinates and confirmed site permission.
    check(
      "spots_publish_requires_coordinates",
      sql`not ${t.published} or ${t.lat} is not null`,
    ),
    check(
      "spots_publish_requires_permission",
      sql`not ${t.published} or ${t.permissionConfirmed}`,
    ),
  ],
);

export const rallyKind = pgEnum("rally_kind", ["mounds", "course"]);

/**
 * A stamp rally. There are many: one for the 31 sutra mound places (kind "mounds", only one of them)
 * and one for each course (kind "course", linked to its route, one per route). Which places belong to a
 * rally is the `rally_spots` table; a place may be in several rallies (a mound is in the mound rally AND in
 * its course's rally), and the one stamp a visitor holds for a place counts in all of them: progress is
 * always computed from stamps (rallies/progress.ts), never stored per rally.
 * The accuracy limit (default 100 m) is app configuration, not stored here.
 */
export const rallies = pgTable(
  "rallies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: rallyKind("kind").notNull().default("course"),
    // Japanese is required in the admin; the column default only fills rows made before names existed.
    nameJa: text("name_ja").notNull().default(""),
    nameEn: text("name_en"),
    // The course of a course rally (one rally per route); null for the mound rally.
    routeId: uuid("route_id").references(() => routes.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
    // How a stamp is verified. Only GPS for now.
    verification: text("verification", { enum: ["gps"] }).notNull().default("gps"),
    // Null means every published spot is required.
    stampsRequired: integer("stamps_required"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Only one mound rally, and only one rally per course.
    uniqueIndex("rallies_one_mounds_uq")
      .on(t.kind)
      .where(sql`${t.kind} = 'mounds'`),
    uniqueIndex("rallies_route_uq").on(t.routeId),
    check(
      "rallies_route_matches_kind",
      sql`(${t.kind} = 'mounds' and ${t.routeId} is null) or (${t.kind} = 'course' and ${t.routeId} is not null)`,
    ),
    check("rallies_stamps_required_positive", sql`${t.stampsRequired} is null or ${t.stampsRequired} > 0`),
    check(
      "rallies_dates_ordered",
      sql`${t.endsAt} is null or ${t.startsAt} is null or ${t.endsAt} > ${t.startsAt}`,
    ),
  ],
);

/**
 * Which places belong to which rally, in what order. A place can be in many rallies. Deleting a rally
 * or a place removes its links (the stamps stay, they belong to the visitor and the place).
 */
export const rallySpots = pgTable(
  "rally_spots",
  {
    rallyId: uuid("rally_id")
      .notNull()
      .references(() => rallies.id, { onDelete: "cascade" }),
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    // The place's number within this rally (1, 2, 3 ...).
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.rallyId, t.spotId] }), index("rally_spots_spot_idx").on(t.spotId)],
);

/**
 * A collected stamp, one per user per spot. The phone's coordinates are never
 * stored.
 */
export const stamps = pgTable(
  "stamps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "restrict" }),
    method: text("method", { enum: ["gps"] }).notNull().default("gps"),
    // Plausibility checks flag a stamp for review; they never block it.
    flagged: boolean("flagged").notNull().default(false),
    flagReason: text("flag_reason"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("stamps_user_spot_uq").on(t.userId, t.spotId),
    index("stamps_spot_idx").on(t.spotId),
    // Admin review queue: flagged and not revoked.
    index("stamps_flagged_review_idx")
      .on(t.createdAt)
      .where(sql`${t.flagged} and ${t.revokedAt} is null`),
  ],
);

/** A dated route-level notice with an official source and an expiry. */
export const trailNotices = pgTable(
  "trail_notices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routeId: uuid("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    bodyJa: text("body_ja").notNull(),
    bodyEn: text("body_en"),
    // Official source; required.
    sourceUrl: text("source_url").notNull(),
    // Age is always shown to participants.
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    // Expired notices are hidden; null means no expiry.
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("trail_notices_route_idx").on(t.routeId, t.expiresAt)],
);

/** Append-only record of admin actions. User ids only: no names or emails. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Kept (as null) if the actor's account is deleted.
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    // For example spot.status.change
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_log_created_idx").on(t.createdAt),
    index("audit_log_actor_idx").on(t.actorUserId),
    index("audit_log_target_idx").on(t.targetType, t.targetId),
  ],
);
