// The visitor's own stamps, read on the server for the screens that show progress (spot page, course page, course list).
// Like the viewer (viewer.ts), the session is the API's HttpOnly cookie, forwarded to GET /stamps; the browser's
// JavaScript never sees it. Server code only: it is on the client-boundary list.

import { cache } from "react";
import { parseMyStampRows, type MyStampRow } from "./stamp-flow";

export interface MyStamps {
  /** Place ids the visitor has stamped (revoked stamps are not in the API's answer). */
  ids: ReadonlySet<string>;
  /** How many places of each course (by course id) the visitor has stamped. */
  byRoute: ReadonlyMap<string, number>;
}

export const noStamps: MyStamps = { ids: new Set(), byRoute: new Map() };

export function myStampsFromRows(rows: readonly MyStampRow[]): MyStamps {
  const byRoute = new Map<string, number>();
  for (const r of rows) if (r.routeId) byRoute.set(r.routeId, (byRoute.get(r.routeId) ?? 0) + 1);
  return { ids: new Set(rows.map((r) => r.spotId)), byRoute };
}

/**
 * Who is signed in decides, so no cookie, an unreachable API, a signed-out session or a slow answer all mean "no
 * stamps": the screens then show nothing stamped, never an error.
 */
export const getMyStamps = cache(async (): Promise<MyStamps> => {
  const { headers } = await import("next/headers");
  const cookie = (await headers()).get("cookie");
  if (!cookie) return noStamps;
  try {
    const res = await fetch(`${process.env.API_ORIGIN ?? "http://localhost:3001"}/api/v1/stamps`, {
      headers: { cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    const rows = parseMyStampRows(res.status, await res.json().catch(() => null));
    return rows ? myStampsFromRows(rows) : noStamps;
  } catch {
    return noStamps;
  }
});
