// The visitor's own stamps (an account's or a guest's), read on the server for the screens that show progress (spot page, course page, course list).
// Like the viewer (viewer.ts), the session is the API's HttpOnly cookie, forwarded to GET /stamps; the browser's
// JavaScript never sees it. Server code only: it is on the client-boundary list.

import { cache } from "react";
import { parseMyCompletions, parseMyStampRows, type MyStampRow } from "./stamp-flow";

export interface MyStamps {
  /** Place ids the visitor has stamped (revoked stamps are not in the API's answer). */
  ids: ReadonlySet<string>;
  /** How many places of each course (by course id) the visitor has stamped. */
  byRoute: ReadonlyMap<string, number>;
  /** When the visitor stamped each place (place id -> ISO time of the latest stamp), for the places whose time is known. */
  at: ReadonlyMap<string, string>;
  /** When the visitor finished each rally (rally id -> ISO time). Accounts only: a guest's stamps keep no finish date. */
  completed: ReadonlyMap<string, string>;
}

export const noStamps: MyStamps = { ids: new Set(), byRoute: new Map(), at: new Map(), completed: new Map() };

export function myStampsFromRows(rows: readonly MyStampRow[], completed: ReadonlyMap<string, string> = new Map()): MyStamps {
  const byRoute = new Map<string, number>();
  for (const r of rows) if (r.routeId) byRoute.set(r.routeId, (byRoute.get(r.routeId) ?? 0) + 1);
  const at = new Map<string, string>();
  for (const r of rows) if (r.createdAt && (!at.has(r.spotId) || Date.parse(r.createdAt) > Date.parse(at.get(r.spotId)!))) at.set(r.spotId, r.createdAt);
  return { ids: new Set(rows.map((r) => r.spotId)), byRoute, at, completed };
}

/**
 * Who is signed in decides, so no cookie, an unreachable API, a signed-out session or a slow answer all mean "no
 * stamps": the screens then show nothing stamped, never an error.
 */
export const getMyStamps = cache(async (): Promise<MyStamps> => {
  const { headers } = await import("next/headers");
  const cookie = (await headers()).get("cookie");
  if (!cookie) return noStamps;
  // A visitor with no account holds theirs in a signed cookie the API reads (guest/guest-routes.ts); a signed-in one, in the account.
  const path = /(^|;\s*)(__Host-)?session=/.test(cookie) ? "/stamps" : /(^|;\s*)(__Host-)?guest=/.test(cookie) ? "/guest/stamps" : null;
  if (!path) return noStamps;
  try {
    const res = await fetch(`${process.env.API_ORIGIN ?? "http://localhost:3001"}/api/v1${path}`, {
      headers: { cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    const body = await res.json().catch(() => null);
    const rows = parseMyStampRows(res.status, body);
    return rows ? myStampsFromRows(rows, parseMyCompletions(res.status, body)) : noStamps;
  } catch {
    return noStamps;
  }
});
