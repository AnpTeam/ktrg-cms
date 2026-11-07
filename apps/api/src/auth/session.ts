import { createHash, randomBytes } from "node:crypto";

const DAY_MS = 24 * 60 * 60 * 1000;

export type SessionRole = "participant" | "editor" | "admin";

/**
 * How long a session lives. `idleMs` slides forward on use; `absoluteMs` is the
 * hard cap from the moment of login. A participant gets about a year; an admin
 * and an editor are logged out after 14 days idle or 30 days in total.
 */
export const SESSION_POLICY: Record<SessionRole, { idleMs: number; absoluteMs: number }> = {
  participant: { idleMs: 365 * DAY_MS, absoluteMs: 365 * DAY_MS },
  editor: { idleMs: 14 * DAY_MS, absoluteMs: 30 * DAY_MS },
  admin: { idleMs: 14 * DAY_MS, absoluteMs: 30 * DAY_MS },
};

/** Only write a slid expiry back when it moved by at least this much. */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 60 * 1000;

/** A long session gets a new token this often, so a copied cookie does not stay good for its whole year. */
export const SESSION_ROTATE_MS = 30 * DAY_MS;
/** After a change: no second new token, and the old one is not retired, so two tabs or a slow upload on weak signal sign nobody out. */
export const SESSION_ROTATE_GRACE_MS = 60 * 60 * 1000;

/**
 * A login (or a re-check with POST /auth/reauth/verify) counts as "fresh" for this long.
 * Permissions marked fresh in the permission table need one, so a stolen or forgotten
 * session cannot use them on its own.
 */
export const FRESH_LOGIN_MS = 10 * 60 * 1000;

/**
 * An editor or admin proves it is them again this often to use the admin screens, or after this longer time on a device
 * they chose to keep. The session's own limits still apply: 14 days unused and 30 days in all.
 */
export const STAFF_CHECK_MS = 12 * 60 * 60 * 1000;
export const STAFF_CHECK_KEPT_MS = 30 * 24 * 60 * 60 * 1000;

/** 256 random bits, URL-safe. Only its SHA-256 hash is stored. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * The __Host- prefix makes the browser refuse the cookie unless it is Secure,
 * has Path=/ and no Domain. Safari rejects Secure cookies over plain
 * http://localhost, so the prefix is production only.
 */
export function sessionCookieName(secure: boolean): string {
  return secure ? "__Host-session" : "session";
}

/**
 * A persistent cookie (Max-Age), set by the server: it survives closing the app
 * and is not subject to Safari's 7 day limit on script-written storage.
 */
export function serializeSessionCookie(opts: {
  name: string;
  value: string;
  maxAgeSec: number;
  secure: boolean;
}): string {
  const parts = [
    `${opts.name}=${opts.value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(opts.maxAgeSec))}`,
  ];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(name: string, secure: boolean): string {
  return serializeSessionCookie({ name, value: "", maxAgeSec: 0, secure });
}

export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim() || null;
  }
  return null;
}
