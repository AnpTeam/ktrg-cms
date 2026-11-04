import { geoFailureFromCode, parseMyStamps, parseStampResponse, readingFrom, type GeoFailure, type Reading, type StampMock, type StampResult } from "./stamp-flow";

// The browser side of stamping. It asks the phone for ONE position (high accuracy, never a cached one) and sends it
// with the request; it never keeps it and never decides anything: the server does (CLAUDE.md, hard rule 5).

export type PositionResult = { ok: true; reading: Reading } | { ok: false; reason: GeoFailure };

/** Wait this long for the phone's position before giving up. */
const POSITION_TIMEOUT_MS = 20_000;

export function readPosition(): Promise<PositionResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve({ ok: false, reason: "unsupported" });
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, reading: readingFrom(pos) }),
      (err) => resolve({ ok: false, reason: geoFailureFromCode(err.code) }),
      { enableHighAccuracy: true, timeout: POSITION_TIMEOUT_MS, maximumAge: 0 },
    );
  });
}

/** Has the visitor already allowed location for this site? Then the explanation before the browser prompt is skipped. */
export async function locationAlreadyAllowed(): Promise<boolean> {
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" });
    return status?.state === "granted";
  } catch {
    return false;
  }
}

async function postStamp(path: string, spotId: string, reading: Reading, scannedAt?: string): Promise<StampResult> {
  try {
    const res = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ spotId, lat: reading.lat, lng: reading.lng, accuracyM: reading.accuracyM, ...(scannedAt ? { scannedAt } : {}) }),
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // no readable body: the status alone decides
    }
    return parseStampResponse(res.status, body);
  } catch {
    return { ok: false, failure: "network" };
  }
}

/**
 * Ask the server for the stamp (contract in stamp-flow.ts). Never throws. Signed out, the same request goes to the guest
 * endpoint, which checks the same things and keeps the stamp in a signed cookie instead of an account.
 */
export async function requestStamp(spotId: string, reading: Reading, scannedAt?: string): Promise<StampResult> {
  const result = await postStamp("/api/v1/stamps", spotId, reading, scannedAt);
  return !result.ok && result.failure === "login_needed" ? postStamp("/api/v1/guest/stamps", spotId, reading, scannedAt) : result;
}

/**
 * Sends one queued stamp as the account it was pressed under: "guest" to the guest endpoint, anything else to the
 * account endpoint ONLY (a signed-out answer stays "login_needed", so the row waits instead of becoming a guest stamp).
 */
export function requestStampFor(userKey: string, spotId: string, reading: Reading, scannedAt: string): Promise<StampResult> {
  return postStamp(userKey === "guest" ? "/api/v1/guest/stamps" : "/api/v1/stamps", spotId, reading, scannedAt);
}

/** The ids of the places this visitor has stamped (account or guest), or null if they could not be read. Never throws. */
export async function fetchMyStamps(): Promise<Set<string> | null> {
  for (const path of ["/api/v1/stamps", "/api/v1/guest/stamps"]) {
    try {
      const res = await fetch(path, { credentials: "same-origin" });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        // no readable body: the status alone decides
      }
      const stamps = parseMyStamps(res.status, body);
      if (stamps) return stamps;
    } catch {
      return null;
    }
  }
  return null;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Development only (the spot page passes `mock` only when NODE_ENV is not production): pretend the phone and the
 * server answered, so every screen of the flow can be reviewed before the stamping API exists. It never runs
 * otherwise, and it cannot give a real stamp.
 */
export async function mockPosition(mock: StampMock): Promise<PositionResult> {
  await wait(500);
  if (mock === "denied" || mock === "unavailable" || mock === "timeout") return { ok: false, reason: mock };
  return { ok: true, reading: { lat: 0, lng: 0, accuracyM: 10 } };
}

export async function mockStamp(mock: StampMock): Promise<StampResult> {
  await wait(600);
  switch (mock) {
    case "already":
      return { ok: true, already: true };
    case "far":
      return { ok: false, failure: "too_far", distanceM: 247 };
    case "weak":
      return { ok: false, failure: "low_accuracy" };
    case "closed":
      return { ok: false, failure: "spot_closed" };
    case "inactive":
      return { ok: false, failure: "rally_not_active" };
    case "notready":
      return { ok: false, failure: "not_ready" };
    default:
      return { ok: true, already: false };
  }
}
