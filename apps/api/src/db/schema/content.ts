import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
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

/**
 * The languages content can be written in (admin entry; the visitor site still speaks ja and en only). Kept apart
 * from user_locale, the website language a visitor picks, so a content language never becomes a website choice.
 */
export const contentLocales = ["ja", "en", "de", "fr", "th", "es"] as const;
export const contentLocale = pgEnum("content_locale", contentLocales);

export const spotStatus = pgEnum("spot_status", ["open", "caution", "closed"]);

/**
 * What a waypoint (a point on a route) is. Whether visitors can stamp there is a separate switch (`spots.stampable`),
 * not a kind: a temple or a viewpoint can be either. turn, danger and view belong to the route only; the rest use the
 * same names as the map's place categories (lib/places.ts in the web app), so toilets and rest areas show up in
 * "places nearby" on the map.
 */
export const spotKinds = [
  "temple",
  "mound",
  "view",
  "turn",
  "danger",
  "toilet",
  "rest_area",
  "drinking_water",
  "vending_machine",
  "bus_stop",
  "station",
  "parking",
  "ferry",
  "campsite",
  "other",
] as const;
export const spotKind = pgEnum("spot_kind", spotKinds);

/** How a visitor gets to or from a route: by train, bus, ferry, car or on foot. */
export const accessTypes = ["train", "bus", "ferry", "car", "walk", "other"] as const;

/** One way of getting there, shown like the Start / Goal badges: the kind, the place's name and a short note, in Japanese and English. */
export interface AccessPoint {
  type: (typeof accessTypes)[number];
  nameJa: string;
  nameEn: string | null;
  noteJa: string | null;
  noteEn: string | null;
  /** An https link for this way of getting there. */
  url?: string | null;
}

/** A photo in a waypoint's gallery: an https link, who took it (when the license asks for a credit), and the page it came from. */
export interface SpotPhoto {
  url: string;
  credit: string | null;
  sourceUrl: string | null;
}

/** The switch a new waypoint starts with: on for a temple, a sutra mound, a viewpoint or "other"; off for the practical ones. */
export const stampableByDefault = (kind: (typeof spotKinds)[number]): boolean =>
  kind === "temple" || kind === "mound" || kind === "view" || kind === "other";

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
    // The mountain-grading levels: physical 1 to 10 and technical "A" to "E" (validated in the API).
    // How the Japanese name is read, shown over it as furigana (ruby).
    nameKana: text("name_kana"),
    // How to get there, in order (see AccessPoint).
    accessPoints: jsonb("access_points").$type<AccessPoint[]>().notNull().default(sql`'[]'::jsonb`),
    physicalLevel: integer("physical_level"),
    technicalLevel: text("technical_level"),
    expectedTimeMin: integer("expected_time_min"),
    // Osaka, Wakayama or Nara (validated in the API).
    prefecture: text("prefecture"),
    // How the route is walked: one_way, loop (ends where it began) or out_and_back (to a turnaround and back the same
    // way). Validated in the API; null until an admin picks one (the route page then says nothing about it).
    walkStyle: text("walk_style"),
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
    // Who took the picture / where it comes from. Shown on it; may hold links (see the web app's rich-text format).
    photoCredit: text("photo_credit"),
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
    kind: spotKind("kind").notNull().default("other"),
    // Visitors can collect a stamp here: it joins rallies, has a check-in radius and needs the site's permission to publish.
    stampable: boolean("stampable").notNull().default(false),
    // An optional visit beside the way (寄り道): the line of the route does not have to pass through it.
    stopBy: boolean("stop_by").notNull().default(false),
    photoUrl: text("photo_url"),
    photoCredit: text("photo_credit"),
    // More photos of the place, in order (the first photo above is its main one).
    photos: jsonb("photos").$type<SpotPhoto[]>().notNull().default(sql`'[]'::jsonb`),
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
      // Every place that visitors can open needs the site's permission, with a stamp or without (a place has its own page).
      sql`not ${t.published} or ${t.permissionConfirmed}`,
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

/**
 * A dated trail notice (a closure, a hazard, a seasonal condition) with an official source and an expiry, entered by
 * an admin after checking that source. A draft until published. No route means the whole trail.
 */
export const trailNotices = pgTable(
  "trail_notices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routeId: uuid("route_id").references(() => routes.id, { onDelete: "cascade" }),
    // Official source; required.
    sourceUrl: text("source_url").notNull(),
    // Days (YYYY-MM-DD, Japan time); the column names are older than the switch from timestamps to days.
    // The day a person last checked the source; its age is always shown to visitors.
    verifiedOn: date("verified_at", { mode: "string" }).notNull(),
    // Hidden after this day; null means no expiry.
    expiresOn: date("expires_at", { mode: "string" }),
    published: boolean("published").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("trail_notices_route_idx").on(t.routeId, t.expiresOn)],
);

/** A photo in the carousel at the top of the home page, in `sort_order`. A draft until published. Its words (the
 * description read out by screen readers) are in banner_translations. */
export const banners = pgTable("banners", {
  id: uuid("id").primaryKey().defaultRandom(),
  // An https link to the photo (uploaded to R2, or pasted).
  imageUrl: text("image_url").notNull(),
  imageCredit: text("image_credit"),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

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
    locale: contentLocale("locale").notNull(),
    name: text("name"),
    description: text("description"),
    // The story of the route, and how to get there and back.
    history: text("history"),
    access: text("access"),
    // Where the words come from (出典), in this language.
    source: text("source"),
  },
  (t) => [primaryKey({ columns: [t.routeId, t.locale] }), check("route_translations_ja_name", jaRequires(t, t.name))],
);

export const spotTranslations = pgTable(
  "spot_translations",
  {
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    locale: contentLocale("locale").notNull(),
    name: text("name"),
    description: text("description"),
    // Its story: where the name comes from, what happened there.
    history: text("history"),
    statusNote: text("status_note"),
    source: text("source"),
  },
  (t) => [primaryKey({ columns: [t.spotId, t.locale] }), check("spot_translations_ja_name", jaRequires(t, t.name))],
);

export const rallyTranslations = pgTable(
  "rally_translations",
  {
    rallyId: uuid("rally_id")
      .notNull()
      .references(() => rallies.id, { onDelete: "cascade" }),
    locale: contentLocale("locale").notNull(),
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
    locale: contentLocale("locale").notNull(),
    title: text("title"),
    body: text("body"),
    sourceName: text("source_name"),
  },
  (t) => [
    primaryKey({ columns: [t.trailNoticeId, t.locale] }),
    check("trail_notice_translations_ja_body", jaRequires(t, t.body)),
    check("trail_notice_translations_ja_title", jaRequires(t, t.title)),
  ],
);

export const bannerTranslations = pgTable(
  "banner_translations",
  {
    bannerId: uuid("banner_id")
      .notNull()
      .references(() => banners.id, { onDelete: "cascade" }),
    locale: contentLocale("locale").notNull(),
    alt: text("alt"),
  },
  (t) => [primaryKey({ columns: [t.bannerId, t.locale] }), check("banner_translations_ja_alt", jaRequires(t, t.alt))],
);

/** Settings for the whole site, one named value each (see site-settings/): the map style visitors see, and later others. */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

/** What a place in the directory is. The same names as the waypoint kinds and the map's place categories (lib/places.ts in the web app). */
export const placeCategories = [
  "souvenir_shop",
  "restaurant",
  "cafe",
  "convenience_store",
  "toilet",
  "rest_area",
  "drinking_water",
  "vending_machine",
  "station",
  "bus_stop",
  "parking",
  "other",
] as const;
export const placeCategory = pgEnum("place_category", placeCategories);
export const placeStatus = pgEnum("place_status", ["open", "closed", "seasonal", "gone", "unknown"]);

/**
 * A place along the courses that is not a waypoint of one: a shop, a cafe, a toilet, a vending machine. Its words
 * (name, description, opening hours, closed days) are in place_translations. Like a waypoint it is a draft until a
 * person has checked its position and its owner's agreement to be listed (a public facility needs none: say so in the note).
 */
export const places = pgTable(
  "places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: placeCategory("category").notNull().default("other"),
    // The course it is on or near; a place may be on none.
    routeId: uuid("route_id").references(() => routes.id, { onDelete: "set null" }),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    positionVerified: boolean("position_verified").notNull().default(false),
    positionSource: text("position_source"),
    address: text("address"),
    phone: text("phone"),
    website: text("website"),
    photoUrl: text("photo_url"),
    photoCredit: text("photo_credit"),
    status: placeStatus("status").notNull().default("unknown"),
    // The day a person last checked the details (opening hours go stale).
    lastVerified: date("last_verified", { mode: "string" }),
    listingConfirmed: boolean("listing_confirmed").notNull().default(false),
    listingNote: text("listing_note"),
    published: boolean("published").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("places_route_idx").on(t.routeId),
    check("places_lat_range", sql`${t.lat} is null or ${t.lat} between -90 and 90`),
    check("places_lng_range", sql`${t.lng} is null or ${t.lng} between -180 and 180`),
    check("places_coordinates_together", sql`(${t.lat} is null) = (${t.lng} is null)`),
    check("places_publish_requires_position", sql`not ${t.published} or (${t.lat} is not null and ${t.positionVerified})`),
    check("places_publish_requires_listing", sql`not ${t.published} or ${t.listingConfirmed}`),
  ],
);

export const placeTranslations = pgTable(
  "place_translations",
  {
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    locale: contentLocale("locale").notNull(),
    name: text("name"),
    description: text("description"),
    hours: text("hours"),
    closedDays: text("closed_days"),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.locale] }), check("place_translations_ja_name", jaRequires(t, t.name))],
);
