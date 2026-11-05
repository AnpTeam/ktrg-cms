// The rules of the "stamp here" button (WBS 3.3.1) with no React and no browser, so they are unit-tested.
//
// The server decides whether a stamp is given (CLAUDE.md: the client never decides). This file only turns what the
// phone and the server say into something the screen can show. Nothing here keeps the coordinates: they are sent
// once, in the request, and forgotten.
//
// The stamping API (apps/api/src/stamps): POST /api/v1/stamps, JSON body { spotId, lat, lng, accuracyM }, session
// cookie. Answers:
//   200 { ok: true, stamp: { spotId, createdAt, flagged, alreadyStamped, finished: { routeIds, rallyIds } } }
//   409 { ok: false, error: "too_far" }              outside the spot's check-in radius (the distance is never sent)
//   422 { ok: false, error: "gps_accuracy_poor" }    the phone's own error radius is over 100 m
//   409 { ok: false, error: "spot_closed" }
//   409 { ok: false, error: "stamp_revoked" }        an admin revoked the stamp held here (shown as a plain failure for now)
//   401 unauthenticated, 429 rate limited, 404 no such spot (a draft, not a stamp place, or no checked position)
// GET /api/v1/stamps answers { ok: true, stamps: [{ spotId, createdAt }] }: the caller's own, revoked ones left out.

/** The phone could not give a position. */
export type GeoFailure = "unsupported" | "denied" | "unavailable" | "timeout";

/** One reading from the phone: where it thinks it is, and how sure it is (its own error radius, in metres). */
export interface Reading {
  lat: number;
  lng: number;
  accuracyM: number;
}

export type StampFailure =
  | "too_far"
  | "low_accuracy"
  | "spot_closed"
  | "rally_not_active"
  | "stale_scan"
  | "bad_time"
  | "not_ready"
  | "login_needed"
  | "guest_full"
  | "too_many_requests"
  | "network"
  | "failed";

/** Courses and rallies this stamp has just completed (ids). */
export interface Finished {
  routeIds: string[];
  rallyIds: string[];
}

export type StampResult = { ok: true; already: boolean; finished?: Finished } | { ok: false; failure: StampFailure; distanceM?: number };

/** Anything that can go wrong in the flow, in the order a visitor meets it. */
export type Problem = GeoFailure | StampFailure;

/** The browser's GeolocationPositionError codes: 1 permission denied, 2 position unavailable, 3 timeout. */
export function geoFailureFromCode(code: number): GeoFailure {
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  return "unavailable";
}

export function readingFrom(pos: { coords: { latitude: number; longitude: number; accuracy: number } }): Reading {
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy };
}

/** Turn the server's answer into a result. Unknown answers are a plain "failed", never a stamp. */
export function parseStampResponse(status: number, body: unknown): StampResult {
  const b = (typeof body === "object" && body !== null ? body : {}) as { ok?: unknown; stamp?: unknown; error?: unknown; distanceM?: unknown };

  if (status === 200 && b.ok === true) {
    // A stamp is only a stamp when the answer carries one.
    if (typeof b.stamp !== "object" || b.stamp === null) return { ok: false, failure: "failed" };
    const s = b.stamp as { alreadyStamped?: unknown; finished?: unknown };
    const finished = finishedFrom(s.finished);
    return { ok: true, already: s.alreadyStamped === true, ...(finished ? { finished } : {}) };
  }
  if (status === 401) return { ok: false, failure: "login_needed" };
  if (status === 429) return { ok: false, failure: "too_many_requests" };
  if (status === 404 || status === 501) return { ok: false, failure: "not_ready" };

  switch (b.error) {
    case "too_far":
      return typeof b.distanceM === "number" && Number.isFinite(b.distanceM) && b.distanceM >= 0
        ? { ok: false, failure: "too_far", distanceM: b.distanceM }
        : { ok: false, failure: "too_far" };
    case "gps_accuracy_poor":
      return { ok: false, failure: "low_accuracy" };
    case "spot_closed":
      return { ok: false, failure: "spot_closed" };
    case "guest_full":
      return { ok: false, failure: "guest_full" };
    case "stale_scan":
      return { ok: false, failure: "stale_scan" };
    case "bad_time":
      return { ok: false, failure: "bad_time" };
    case "rally_not_active":
      return { ok: false, failure: "rally_not_active" };
    default:
      return { ok: false, failure: "failed" };
  }
}

const isIds = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

function finishedFrom(v: unknown): Finished | null {
  const f = (typeof v === "object" && v !== null ? v : {}) as { routeIds?: unknown; rallyIds?: unknown };
  return isIds(f.routeIds) && isIds(f.rallyIds) ? { routeIds: f.routeIds, rallyIds: f.rallyIds } : null;
}

/** One stamp of the caller's from GET /api/v1/stamps: the place and the course it belongs to. */
export interface MyStampRow {
  spotId: string;
  routeId: string | null;
  /** When it was collected (ISO), when the answer says. */
  createdAt?: string | null;
}

/** The caller's own stamps from GET /api/v1/stamps; null when the answer is not usable (never an empty list by mistake). */
export function parseMyStampRows(status: number, body: unknown): MyStampRow[] | null {
  const b = (typeof body === "object" && body !== null ? body : {}) as { ok?: unknown; stamps?: unknown };
  if (status !== 200 || b.ok !== true || !Array.isArray(b.stamps)) return null;
  const rows: MyStampRow[] = [];
  for (const s of b.stamps) {
    const r = (s ?? {}) as { spotId?: unknown; routeId?: unknown; createdAt?: unknown };
    if (typeof r.spotId === "string") rows.push({ spotId: r.spotId, routeId: typeof r.routeId === "string" && r.routeId ? r.routeId : null, createdAt: typeof r.createdAt === "string" && !Number.isNaN(Date.parse(r.createdAt)) ? r.createdAt : null });
  }
  return rows;
}

/** When the caller finished each rally (rally id -> ISO time), from the same answer; empty when there is none or it is not usable. */
export function parseMyCompletions(status: number, body: unknown): Map<string, string> {
  const out = new Map<string, string>();
  const b = (typeof body === "object" && body !== null ? body : {}) as { ok?: unknown; completions?: unknown };
  if (status !== 200 || b.ok !== true || !Array.isArray(b.completions)) return out;
  for (const c of b.completions) {
    const r = (c ?? {}) as { rallyId?: unknown; completedAt?: unknown };
    if (typeof r.rallyId === "string" && typeof r.completedAt === "string" && !Number.isNaN(Date.parse(r.completedAt))) out.set(r.rallyId, r.completedAt);
  }
  return out;
}

/** The same as a set of place ids. */
export function parseMyStamps(status: number, body: unknown): Set<string> | null {
  const rows = parseMyStampRows(status, body);
  return rows ? new Set(rows.map((r) => r.spotId)) : null;
}

/** A distance people can read: to the nearest 10 m under a kilometre (at least 10), otherwise to the nearest 100 m. */
export function roundedDistance(metres: number): number {
  if (metres < 1000) return Math.max(10, Math.round(metres / 10) * 10);
  return Math.round(metres / 100) * 100;
}

/** "約300m" is spoken as "300 m"; from a kilometre up it is kilometres with one decimal ("1.2 km"). */
export function distanceParts(metres: number): { value: number; unit: "m" | "km" } {
  const rounded = roundedDistance(metres);
  return rounded >= 1000 ? { value: Math.round(rounded / 100) / 10, unit: "km" } : { value: rounded, unit: "m" };
}

/** Development only: the screens can be reviewed with `?stamp=far` and so on, without a stamping API. */
export const stampMocks = ["ok", "already", "far", "weak", "closed", "inactive", "notready", "denied", "unavailable", "timeout"] as const;
export type StampMock = (typeof stampMocks)[number];

export function isStampMock(value: unknown): value is StampMock {
  return typeof value === "string" && (stampMocks as readonly string[]).includes(value);
}
