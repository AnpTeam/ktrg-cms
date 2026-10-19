// The rules of the "stamp here" button (WBS 3.3.1) with no React and no browser, so they are unit-tested.
//
// The server decides whether a stamp is given (CLAUDE.md: the client never decides). This file only turns what the
// phone and the server say into something the screen can show. Nothing here keeps the coordinates: they are sent
// once, in the request, and forgotten.
//
// CONTRACT for the stamping API (WBS 2.4.2, not built yet): POST /api/v1/spots/{id}/stamp, JSON body
// { lat, lng, accuracyM }, session cookie. Answers:
//   200 { ok: true, status: "stamped" | "already_stamped" }
//   409 { ok: false, error: "too_far", distanceM?: number }       outside the spot's check-in radius
//   409 { ok: false, error: "accuracy_too_low" }                   the phone's own error radius is over the limit
//   409 { ok: false, error: "spot_closed" }
//   409 { ok: false, error: "rally_not_active" }
//   401 unauthenticated, 429 rate_limited, 404 no such spot (or a draft)

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
  | "not_ready"
  | "login_needed"
  | "too_many_requests"
  | "network"
  | "failed";

export type StampResult = { ok: true; already: boolean } | { ok: false; failure: StampFailure; distanceM?: number };

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
  const b = (typeof body === "object" && body !== null ? body : {}) as { ok?: unknown; status?: unknown; error?: unknown; distanceM?: unknown };

  if (status === 200 && b.ok === true) return { ok: true, already: b.status === "already_stamped" };
  if (status === 401) return { ok: false, failure: "login_needed" };
  if (status === 429) return { ok: false, failure: "too_many_requests" };
  if (status === 404 || status === 501) return { ok: false, failure: "not_ready" };

  switch (b.error) {
    case "too_far":
      return typeof b.distanceM === "number" && Number.isFinite(b.distanceM) && b.distanceM >= 0
        ? { ok: false, failure: "too_far", distanceM: b.distanceM }
        : { ok: false, failure: "too_far" };
    case "accuracy_too_low":
      return { ok: false, failure: "low_accuracy" };
    case "spot_closed":
      return { ok: false, failure: "spot_closed" };
    case "rally_not_active":
      return { ok: false, failure: "rally_not_active" };
    default:
      return { ok: false, failure: "failed" };
  }
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
