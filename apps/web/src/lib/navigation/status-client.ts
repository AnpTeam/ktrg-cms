export type Status = "open" | "caution" | "closed" | "info";

/** A status read after the page was drawn with `shown`. */
export type LiveStatus = { spotId: string; shown: Status; status: Status };

/** The newer status, unless it was read for another place or before the page was drawn again with a new one. */
export const liveStatus = (latest: LiveStatus | null, spotId: string, shown: Status): Status =>
  latest && latest.spotId === spotId && latest.shown === shown ? latest.status : shown;

/** The statuses in the answer of GET /spots/status; anything else in it is left out. */
export function parseStatuses(body: unknown): Map<string, Status> | null {
  const spots = (body as { ok?: unknown; spots?: unknown } | null)?.spots;
  if (!Array.isArray(spots)) return null;
  const out = new Map<string, Status>();
  for (const s of spots as { id?: unknown; status?: unknown }[]) {
    if (typeof s?.id === "string" && (s.status === "open" || s.status === "caution" || s.status === "closed" || s.status === "info")) out.set(s.id, s.status);
  }
  return out;
}

/** Every published place's status, or null with no signal: then the last known ones stay. Never throws. */
export async function fetchStatuses(): Promise<Map<string, Status> | null> {
  try {
    const res = await fetch("/api/v1/spots/status", { credentials: "same-origin" });
    return res.ok ? parseStatuses(await res.json()) : null;
  } catch {
    return null;
  }
}
