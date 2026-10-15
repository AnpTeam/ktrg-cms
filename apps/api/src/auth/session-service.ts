import {
  FRESH_LOGIN_MS,
  SESSION_POLICY,
  SESSION_TOUCH_INTERVAL_MS,
  generateSessionToken,
  hashSessionToken,
} from "./session";
import type { AuthUser } from "./user";

export interface SessionRecord {
  id: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  /** The last full login or fresh-login re-check. */
  lastLoginAt: Date;
}

/** Storage the session service needs; the Drizzle version is in session-store.ts. */
export interface SessionStore {
  create(row: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    absoluteExpiresAt: Date;
    now: Date;
  }): Promise<void>;
  find(tokenHash: string): Promise<{ session: SessionRecord; user: AuthUser } | null>;
  touch(id: string, lastSeenAt: Date, expiresAt: Date): Promise<void>;
  remove(tokenHash: string): Promise<void>;
  /** Record a fresh-login re-check: sets lastLoginAt. */
  markFresh(id: string, at: Date): Promise<void>;
}

export interface Authenticated {
  user: AuthUser;
  sessionId: string;
  /** Until when this session counts as freshly logged in (see FRESH_LOGIN_MS). */
  freshUntil: Date;
  /** Is it still before freshUntil? */
  fresh: boolean;
  expiresAt: Date;
  /** True when the expiry slid forward, so the cookie should be re-issued. */
  refreshed: boolean;
}

export function createSessionService({
  store,
  now = () => new Date(),
}: {
  store: SessionStore;
  now?: () => Date;
}) {
  return {
    /** Start a session after a successful login. The token goes in the cookie only. */
    async create(user: AuthUser): Promise<{ token: string; expiresAt: Date }> {
      const at = now();
      const policy = SESSION_POLICY[user.role];
      const absoluteExpiresAt = new Date(at.getTime() + policy.absoluteMs);
      const expiresAt = new Date(Math.min(at.getTime() + policy.idleMs, absoluteExpiresAt.getTime()));
      const token = generateSessionToken();
      await store.create({ userId: user.id, tokenHash: hashSessionToken(token), expiresAt, absoluteExpiresAt, now: at });
      return { token, expiresAt };
    },

    /** The user behind a cookie token, or null if unknown, expired or past its hard cap. */
    async authenticate(token: string): Promise<Authenticated | null> {
      const tokenHash = hashSessionToken(token);
      const found = await store.find(tokenHash);
      if (!found) return null;

      const at = now().getTime();
      const { session, user } = found;
      const freshEnd = freshUntil(session.lastLoginAt);
      const base = { user, sessionId: session.id, freshUntil: freshEnd, fresh: at < freshEnd.getTime() };
      if (at >= session.expiresAt.getTime() || at >= session.absoluteExpiresAt.getTime()) {
        await store.remove(tokenHash);
        return null;
      }

      // Slide the idle expiry forward, never past the absolute cap.
      const slid = Math.min(at + SESSION_POLICY[user.role].idleMs, session.absoluteExpiresAt.getTime());
      if (slid - session.expiresAt.getTime() < SESSION_TOUCH_INTERVAL_MS) {
        return { ...base, expiresAt: session.expiresAt, refreshed: false };
      }
      const expiresAt = new Date(slid);
      await store.touch(session.id, new Date(at), expiresAt);
      return { ...base, expiresAt, refreshed: true };
    },

    /** The user just proved it is them again (POST /auth/reauth/verify). Returns the new freshUntil. */
    async markFresh(sessionId: string): Promise<Date> {
      const at = now();
      await store.markFresh(sessionId, at);
      return freshUntil(at);
    },

    /** Log out: forget the session on the server. */
    async destroy(token: string): Promise<void> {
      await store.remove(hashSessionToken(token));
    },
  };
}

function freshUntil(lastLoginAt: Date): Date {
  return new Date(lastLoginAt.getTime() + FRESH_LOGIN_MS);
}

export type SessionService = ReturnType<typeof createSessionService>;
