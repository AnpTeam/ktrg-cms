import { treaty } from "@elysiajs/eden";
import type { App } from "@ktrg/api"; // type only: nothing from the API is bundled

/**
 * Where the API is reached from the current runtime.
 * - Browser: the page's own origin. `/api/v1/*` is proxied to Elysia by the
 *   rewrite in next.config.ts, so session cookies stay same-origin.
 * - Server (RSC, build): there is no page origin, so call the API directly.
 *   Cookies are not forwarded here; pass them explicitly if a server call
 *   ever needs the signed-in user.
 */
function defaultOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.API_ORIGIN ?? "http://localhost:3001";
}

/** Eden Treaty client for the Elysia API, rooted at `/api/v1`. */
export function createApi(origin: string = defaultOrigin()) {
  return treaty<App>(origin, {
    fetch: { credentials: "same-origin" },
  }).api.v1;
}

export type Api = ReturnType<typeof createApi>;

export const api = createApi();
