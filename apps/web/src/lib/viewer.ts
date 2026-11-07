// Who is looking: signed out or signed in, and by what name. Pages ask for the viewer once and pass
// what they need down; components never read cookies. The session is the API's HttpOnly cookie:
// the server forwards it to GET /me (it is never readable from the browser's JavaScript).

import { cache } from "react";
import { ageRanges, foundVias, genders, origins, type AgeRange, type FoundVia, type Gender, type Origin } from "./auth-flow";
import { accountPrefs, type Prefs } from "./prefs";

export interface Viewer {
  signedIn: boolean;
  /** The account's role (what it may do); null when signed out or when the API did not say. */
  role: "participant" | "editor" | "admin" | null;
  /** The unique 8-digit ID shown on the profile (quote it to support); null when signed out. */
  publicId: string | null;
  /** When a requested account deletion will really happen (ISO time); null with no request. */
  deletionDueAt: string | null;
  /** An admin asked for the deletion: the owner can appeal, not cancel. */
  deletionByAdmin?: boolean;
  deletionAppeal?: string | null;
  /** The display name given at sign-up; null when signed out or when there is none. */
  name: string | null;
  /** A photo of the person (staff only; shown as a blog byline); left out or null when none. */
  avatarUrl?: string | null;
  /** Where they say they come from (set at sign-up); null when not said. */
  origin: Origin | null;
  originPlace: string | null;
  /** Age band and gender they answered after registering; null when not answered. */
  ageRange: AgeRange | null;
  gender: Gender | null;
  /** The account's email; null when signed out or for an account made with a passkey alone. */
  email: string | null;
  /** How they found the rally; null when not answered. */
  foundVia: FoundVia | null;
  /** The accessibility and map choices saved on the account; null when none were saved. */
  preferences: Prefs | null;
  /** The routes they bookmarked (ids, newest first); empty when signed out. */
  bookmarks: string[];
}

export const signedOut: Viewer = { signedIn: false, role: null, publicId: null, deletionDueAt: null, name: null, origin: null, originPlace: null, ageRange: null, gender: null, email: null, foundVia: null, preferences: null, bookmarks: [] };

/**
 * Development only: `?as=in` / `?as=out` forces a viewer so both screens can be reviewed without
 * an API or a login; anything else (or production) returns null and the real session decides.
 */
export function resolveViewer(params: { as?: string }, env: { NODE_ENV?: string } = process.env): Viewer | null {
  if (env.NODE_ENV === "production") return null;
  if (params.as === "in") return { signedIn: true, role: null, publicId: null, deletionDueAt: null, name: null, origin: null, originPlace: null, ageRange: null, gender: null, email: null, foundVia: null, preferences: null, bookmarks: [] };
  if (params.as === "out") return signedOut;
  return null;
}

/** Name of the dev-only cookie that remembers `?as=in` / `?as=out` while browsing (`?as=auto` clears it). */
export const devViewerCookie = "dev_as";

/** Read the profile from GET /me's answer; anything unexpected is signed out. */
export function viewerFromMe(status: number, body: unknown): Viewer {
  if (status !== 200) return signedOut;
  const me = (body as { ok?: unknown; me?: { role?: unknown; publicId?: unknown; deletionDueAt?: unknown; deletionByAdmin?: unknown; deletionAppeal?: unknown; displayName?: unknown; avatarUrl?: unknown; origin?: unknown; originPlace?: unknown; ageRange?: unknown; gender?: unknown; email?: unknown; foundVia?: unknown; preferences?: unknown; bookmarks?: unknown } } | null)?.me;
  if ((body as { ok?: unknown } | null)?.ok !== true || !me) return signedOut;
  return {
    signedIn: true,
    role: me.role === "admin" || me.role === "editor" || me.role === "participant" ? me.role : null,
    publicId: typeof me.publicId === "string" && me.publicId ? me.publicId : null,
    deletionDueAt: typeof me.deletionDueAt === "string" && me.deletionDueAt ? me.deletionDueAt : null,
    deletionByAdmin: me.deletionByAdmin === true,
    deletionAppeal: typeof me.deletionAppeal === "string" ? me.deletionAppeal : null,
    name: typeof me.displayName === "string" && me.displayName ? me.displayName : null,
    avatarUrl: typeof me.avatarUrl === "string" && me.avatarUrl ? me.avatarUrl : null,
    origin: origins.find((o) => o === me.origin) ?? null,
    originPlace: typeof me.originPlace === "string" ? me.originPlace : null,
    ageRange: ageRanges.find((a) => a === me.ageRange) ?? null,
    gender: genders.find((g) => g === me.gender) ?? null,
    email: typeof me.email === "string" && me.email ? me.email : null,
    foundVia: foundVias.find((f) => f === me.foundVia) ?? null,
    preferences: accountPrefs(me.preferences),
    bookmarks: Array.isArray(me.bookmarks) ? me.bookmarks.filter((b): b is string => typeof b === "string") : [],
  };
}

/** Ask the API who the session cookie belongs to. No cookie, no API or a very slow one all mean signed out. */
const sessionViewer = cache(async (): Promise<Viewer> => {
  const { headers } = await import("next/headers");
  const cookie = (await headers()).get("cookie");
  if (!cookie) return signedOut;
  const started = Date.now();
  try {
    const res = await fetch(`${process.env.API_ORIGIN ?? "http://localhost:3001"}/api/v1/me`, {
      headers: { cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(6000), // a slow API must not look like a signed-out visitor
    });
    const body = await res.json().catch(() => null);
    const ms = Date.now() - started;
    if (ms > 1000 || res.status >= 500) console.warn(`[web] /me answered ${res.status} in ${ms} ms`);
    return viewerFromMe(res.status, body);
  } catch (error) {
    // Looks like being signed out to the visitor, so it must show up here. Status, time and error name only: never the cookie.
    console.error(`[web] /me failed after ${Date.now() - started} ms: ${error instanceof Error ? error.name : "unknown"}`);
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
