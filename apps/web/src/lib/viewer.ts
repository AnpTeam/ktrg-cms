// Who is looking: signed out or signed in, and by what name. Pages ask for the viewer once and pass
// what they need down; components never read cookies. The session is the API's HttpOnly cookie:
// the server forwards it to GET /me (it is never readable from the browser's JavaScript).

import { cache } from "react";
import { origins, type Origin } from "./auth-flow";
import { accountPrefs, type Prefs } from "./prefs";

export interface Viewer {
  signedIn: boolean;
  /** The display name given at sign-up; null when signed out or when there is none. */
  name: string | null;
  /** Where they say they come from (set at sign-up); null when not said. */
  origin: Origin | null;
  /** The accessibility and map choices saved on the account; null when none were saved. */
  preferences: Prefs | null;
}

export const signedOut: Viewer = { signedIn: false, name: null, origin: null, preferences: null };

/**
 * Development only: `?as=in` / `?as=out` forces a viewer so both screens can be reviewed without
 * an API or a login; anything else (or production) returns null and the real session decides.
 */
export function resolveViewer(params: { as?: string }, env: { NODE_ENV?: string } = process.env): Viewer | null {
  if (env.NODE_ENV === "production") return null;
  if (params.as === "in") return { signedIn: true, name: null, origin: null, preferences: null };
  if (params.as === "out") return signedOut;
  return null;
}

/** Name of the dev-only cookie that remembers `?as=in` / `?as=out` while browsing (`?as=auto` clears it). */
export const devViewerCookie = "dev_as";

/** Read the profile from GET /me's answer; anything unexpected is signed out. */
export function viewerFromMe(status: number, body: unknown): Viewer {
  if (status !== 200) return signedOut;
  const me = (body as { ok?: unknown; me?: { displayName?: unknown; origin?: unknown; preferences?: unknown } } | null)?.me;
  if ((body as { ok?: unknown } | null)?.ok !== true || !me) return signedOut;
  return {
    signedIn: true,
    name: typeof me.displayName === "string" && me.displayName ? me.displayName : null,
    origin: origins.find((o) => o === me.origin) ?? null,
    preferences: accountPrefs(me.preferences),
  };
}

/** Ask the API who the session cookie belongs to. No cookie, no API or a slow one all mean signed out. */
const sessionViewer = cache(async (): Promise<Viewer> => {
  const { headers } = await import("next/headers");
  const cookie = (await headers()).get("cookie");
  if (!cookie) return signedOut;
  try {
    const res = await fetch(`${process.env.API_ORIGIN ?? "http://localhost:3001"}/api/v1/me`, {
      headers: { cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    return viewerFromMe(res.status, await res.json().catch(() => null));
  } catch {
    return signedOut;
  }
});

/**
 * Pages call this with their `searchParams` (the layout calls it without). The real session decides,
 * except in development where `?as=` or the cookie the proxy set can force a viewer.
 */
export async function getViewer(searchParams?: Promise<{ as?: string }>): Promise<Viewer> {
  if (process.env.NODE_ENV !== "production") {
    let as = (await searchParams)?.as;
    if (!as) {
      const { cookies } = await import("next/headers");
      as = (await cookies()).get(devViewerCookie)?.value;
    }
    const forced = resolveViewer({ as });
    if (forced) return forced;
  }
  return sessionViewer();
}
