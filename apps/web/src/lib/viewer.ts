// Who is looking: signed out or signed in (WBS 3.1.4 will read the real session).
// Pages ask for the viewer once and pass what they need down; components never read cookies.

export interface Viewer {
  signedIn: boolean;
}

/**
 * Production returns signed out until the session API (`/me`) exists, so nobody sees
 * invented progress. In development the default is signed in (there is no login yet, and a
 * developer should not have to sign in on every run); `?as=out` previews the signed-out screens.
 */
export function resolveViewer(params: { as?: string }, env: { NODE_ENV?: string } = process.env): Viewer {
  if (env.NODE_ENV === "production") return { signedIn: false };
  return { signedIn: params.as !== "out" };
}

/** Name of the dev-only cookie that remembers `?as=in` / `?as=out` while browsing. */
export const devViewerCookie = "dev_as";

/**
 * Pages call this with their `searchParams`. In production it returns before anything
 * is read, so a page that only needs the viewer can stay statically rendered. In
 * development the choice comes from `?as=` or, on later pages, from the cookie the proxy set.
 */
export async function getViewer(searchParams?: Promise<{ as?: string }>): Promise<Viewer> {
  if (process.env.NODE_ENV === "production") return { signedIn: false };
  let as = (await searchParams)?.as;
  if (!as) {
    const { cookies } = await import("next/headers");
    as = (await cookies()).get(devViewerCookie)?.value;
  }
  return resolveViewer({ as });
}
