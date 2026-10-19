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
import { userLocale, users } from "./auth";

// Table definitions follow section 9.4 of the system design document.

export const spotStatus = pgEnum("spot_status", ["open", "caution", "closed"]);

/**
 * What a point on a route is. "stamp" is a stamp place (it joins rallies and needs the site's permission).
 * The others are navigation points along the way: turn, danger and view belong to the route only; the rest use the
 * same names as the map's place categories (lib/places.ts in the web app), so toilets and rest areas show up in
 * "places nearby" on the map. They never count in a rally.
 */
export const spotKinds = [
  "stamp",
  "turn",
  "danger",
  "view",
  "toilet",
  "rest_area",
  "drinking_water",
  "vending_machine",
  "bus_stop",
  "station",
  "parking",
  "other",
] as const;
export const spotKind = pgEnum("spot_kind", spotKinds);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/**
 * A trail route (19 of them). Its words are in route_translations (Japanese required, English falls back to it).
 * Most fields are nullable so routes can be seeded as skeletons and filled in
 * through the CMS.
 */
export const routes = pgTable(
  "routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    distanceKm: numeric("distance_km", { precision: 6, scale: 2, mode: "number" }),
    elevationGainM: integer("elevation_gain_m"),
    difficulty: text("difficulty"),
    expectedTimeMin: integer("expected_time_min"),
    // Osaka, Wakayama or Nara (validated in the API).
    prefecture: text("prefecture"),
    municipality: text("municipality"),
    // GeoJSON line drawn on the map.
    geometry: jsonb("geometry"),
    // Like a place's position: the line stays hidden from visitors until a person has checked it against an
    // official source (named in line_source). Changing the line cancels the check.
    lineVerified: boolean("line_verified").notNull().default(false),
    lineSource: text("line_source"),
    // YouTube / Vimeo only; the host is checked in the API.
    videoUrl: text("video_url"),
    // A picture of the route: an https address (an upload comes when a storage provider is chosen).
    photoUrl: text("photo_url"),
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
    // Entered by an admin from an official source.
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    // True once a person has checked the position against an official source (named in position_source).
    // Until then the position is a draft: the public API does not return it and the place cannot be published.
    positionVerified: boolean("position_verified").notNull().default(false),
    positionSource: text("position_source"),
    // Check-in radius in metres.
    radiusM: integer("radius_m").notNull().default(50),
    kind: spotKind("kind").notNull().default("stamp"),
    photoUrl: text("photo_url"),
    status: spotStatus("status").notNull().default("open"),
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
      // Only a stamp place needs the site's permission; a toilet or a turn on the path does not.
      sql`not ${t.published} or ${t.permissionConfirmed} or ${t.kind} <> 'stamp'`,
    ),
    check(
      "spots_publish_requires_verified_position",
      sql`not ${t.published} or ${t.positionVerified}`,
    ),
  ],
);

/**
 * How a rally is made, chosen when it is created and fixed afterwards: "places" = a list of stamp places
 * (rally_spots; the sutra-mound rally is one), "course" = a list of courses (rally_routes).
 */
export const rallyKind = pgEnum("rally_kind", ["places", "course"]);

/**
 * A stamp rally (the user's model, 2026-10-19): one place gives one stamp; a course is finished when every
 * published stamp place on it is stamped. A rally of places is finished when all its places are stamped; a rally
 * of courses when every course in it is finished. Finishing is saved (course_completions, rally_completions);
 * progress before that is computed from stamps (rallies/progress.ts).
 */
export const rallies = pgTable("rallies", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: rallyKind("kind").notNull().default("course"),
  sortOrder: integer("sort_order").notNull().default(0),
  // Visitors see a rally only once an admin publishes it.
  published: boolean("published").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * The places of a rally of places (kind "places", such as the sutra-mound rally), in order; rallies of courses list
 * courses in rally_routes instead. Deleting the rally or a place removes the link; the stamps stay, they belong to
 * the visitor and the place.
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
 * The courses of a rally of courses, in order. A course may be in several rallies. Deleting a rally or an (empty)
 * route removes the link; stamps and completions of the course stay.
 */
export const rallyRoutes = pgTable(
  "rally_routes",
  {
    rallyId: uuid("rally_id")
      .notNull()
      .references(() => rallies.id, { onDelete: "cascade" }),
    routeId: uuid("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    // The course's number within this rally (1, 2, 3 ...).
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.rallyId, t.routeId] }), index("rally_routes_route_idx").on(t.routeId)],
);

/**
 * A visitor finished a course: every published stamp place on it was stamped (a closed place counts as done).
 * Saved once, when it happens, and kept even if a place is added to the course later.
 */
export const courseCompletions = pgTable(
  "course_completions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    routeId: uuid("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.routeId] }), index("course_completions_route_idx").on(t.routeId)],
);

/**
 * A visitor finished a rally: every course in it (or, for the sutra-mound rally, every mound place) was finished.
 * Saved once, when it happens, and kept even if the rally gets more courses later.
 */
export const rallyCompletions = pgTable(
  "rally_completions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rallyId: uuid("rally_id")
      .notNull()
      .references(() => rallies.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.rallyId] }), index("rally_completions_rally_idx").on(t.rallyId)],
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

/*
 * The words of routes, places, rallies and notices, one row per language (ja / en, the user_locale enum).
 * Japanese is required: its row always exists and has a name (body for a notice), which the checks enforce
 * for the row. English is optional, and every English field falls back to the Japanese one when read.
 * A row goes with its owner.
 */
const jaRequires = (t: { locale: unknown }, field: unknown) => sql`${t.locale} <> 'ja' or ${field} is not null`;

export const routeTranslations = pgTable(
  "route_translations",
  {
    routeId: uuid("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    locale: userLocale("locale").notNull(),
    name: text("name"),
    description: text("description"),
    // The story of the route, and how to get there and back.
    history: text("history"),
    access: text("access"),
  },
  (t) => [primaryKey({ columns: [t.routeId, t.locale] }), check("route_translations_ja_name", jaRequires(t, t.name))],
);

export const spotTranslations = pgTable(
  "spot_translations",
  {
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    locale: userLocale("locale").notNull(),
    name: text("name"),
    description: text("description"),
    statusNote: text("status_note"),
  },
  (t) => [primaryKey({ columns: [t.spotId, t.locale] }), check("spot_translations_ja_name", jaRequires(t, t.name))],
);

export const rallyTranslations = pgTable(
  "rally_translations",
  {
    rallyId: uuid("rally_id")
      .notNull()
      .references(() => rallies.id, { onDelete: "cascade" }),
    locale: userLocale("locale").notNull(),
    name: text("name"),
  },
  (t) => [primaryKey({ columns: [t.rallyId, t.locale] }), check("rally_translations_ja_name", jaRequires(t, t.name))],
);

export const trailNoticeTranslations = pgTable(
  "trail_notice_translations",
  {
    trailNoticeId: uuid("trail_notice_id")
      .notNull()
      .references(() => trailNotices.id, { onDelete: "cascade" }),
    locale: userLocale("locale").notNull(),
    body: text("body"),
  },
  (t) => [primaryKey({ columns: [t.trailNoticeId, t.locale] }), check("trail_notice_translations_ja_body", jaRequires(t, t.body))],
);
