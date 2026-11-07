import {
  FRESH_LOGIN_MS,
  STAFF_CHECK_KEPT_MS,
  STAFF_CHECK_MS,
  SESSION_POLICY,
  SESSION_ROTATE_GRACE_MS,
  SESSION_ROTATE_MS,
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
  /** Until when the admin screens are open to this session; null: never checked (see STAFF_CHECK_MS). */
  staffCheckedUntil: Date | null;
  rotatedAt: Date;
  /** The token before the last change has not been replaced in use yet. */
  rotating: boolean;
  /** This token is that older one: the phone never got the new one. */
  viaPrevious: boolean;
}

/** Storage the session service needs; the Drizzle version is in session-store.ts. */
export interface SessionStore {
  create(row: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    absoluteExpiresAt: Date;
    now: Date;
    lastLoginAt: Date;
    staffCheckedUntil: Date | null;
  }): Promise<void>;
  find(tokenHash: string): Promise<{ session: SessionRecord; user: AuthUser } | null>;
  touch(id: string, lastSeenAt: Date, expiresAt: Date): Promise<void>;
  /**
   * A new token, unless the last change is later than `notAfter` (false: one at a time, decided in this one write). The old
   * token keeps working until `settle`; a new token not yet used is simply replaced.
   */
  rotate(id: string, tokenHash: string, at: Date, notAfter: Date): Promise<boolean>;
  /** The new token was used: the old one ends. */
  settle(id: string): Promise<void>;
  remove(tokenHash: string): Promise<void>;
  /** Record a fresh-login re-check: sets lastLoginAt, and moves staffCheckedUntil to this time unless it is already later. */
  markFresh(id: string, at: Date, staffCheckedUntil: Date): Promise<void>;
  /** The device is kept: sets staffCheckedUntil. */
  keepStaffCheck(id: string, until: Date): Promise<void>;
  /** End every session of this account except one. */
  removeOthers(userId: string, keepSessionId: string): Promise<void>;
  removeAll(userId: string): Promise<void>;
}

export interface Authenticated {
  user: AuthUser;
  sessionId: string;
  /** Until when this session counts as freshly logged in (see FRESH_LOGIN_MS). */
  freshUntil: Date;
  /** Is it still before freshUntil? */
  fresh: boolean;
  /** May this session use the admin screens right now (see STAFF_CHECK_MS)? */
  staffChecked: boolean;
  expiresAt: Date;
  /** The token is due for a change (see `rotate`). */
  rotateDue: boolean;
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
    /**
     * Start a session after a successful login. The token goes in the cookie only. `fresh: false` starts it as if the login
     * were long ago, for a login too weak to count as a fresh login (a password).
     */
    async create(user: AuthUser, { fresh = true }: { fresh?: boolean } = {}): Promise<{ token: string; expiresAt: Date }> {
      const at = now();
      const policy = SESSION_POLICY[user.role];
      const absoluteExpiresAt = new Date(at.getTime() + policy.absoluteMs);
      const expiresAt = new Date(Math.min(at.getTime() + policy.idleMs, absoluteExpiresAt.getTime()));
      const token = generateSessionToken();
      const lastLoginAt = fresh ? at : new Date(at.getTime() - FRESH_LOGIN_MS);
      await store.create({ userId: user.id, tokenHash: hashSessionToken(token), expiresAt, absoluteExpiresAt, now: at, lastLoginAt, staffCheckedUntil: fresh ? new Date(at.getTime() + STAFF_CHECK_MS) : null });
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
      const staffChecked = session.staffCheckedUntil !== null && at < session.staffCheckedUntil.getTime();
      const sinceRotated = at - session.rotatedAt.getTime();
      const rotateDue = sinceRotated >= (session.viaPrevious ? SESSION_ROTATE_GRACE_MS : SESSION_ROTATE_MS);
      const base = { user, sessionId: session.id, freshUntil: freshEnd, fresh: at < freshEnd.getTime(), staffChecked, rotateDue };
      // A cap further away than the role allows means the session began under a longer policy
      // (a participant since promoted): end it, so the new role's limit applies.
      const capTooFar = session.absoluteExpiresAt.getTime() - at > SESSION_POLICY[user.role].absoluteMs;
      if (at >= session.expiresAt.getTime() || at >= session.absoluteExpiresAt.getTime() || capTooFar) {
        await store.remove(tokenHash);
        return null;
      }

      if (session.rotating && !session.viaPrevious && sinceRotated >= SESSION_ROTATE_GRACE_MS) await store.settle(session.id);

      // Slide the idle expiry forward, never past the absolute cap.
      const slid = Math.min(at + SESSION_POLICY[user.role].idleMs, session.absoluteExpiresAt.getTime());
      if (slid - session.expiresAt.getTime() < SESSION_TOUCH_INTERVAL_MS) {
        return { ...base, expiresAt: session.expiresAt, refreshed: false };
      }
      const expiresAt = new Date(slid);
      await store.touch(session.id, new Date(at), expiresAt);
      return { ...base, expiresAt, refreshed: true };
    },

    /**
     * A new token for this session. Only from a request the browser itself sends (POST /auth/session/rotate): a page rendered on
     * the server forwards the cookie, and a new one sent back there would never reach the browser. Null: another request just did.
     */
    async rotate(sessionId: string): Promise<string | null> {
      const token = generateSessionToken();
      const at = now();
      return (await store.rotate(sessionId, hashSessionToken(token), at, new Date(at.getTime() - SESSION_ROTATE_GRACE_MS))) ? token : null;
    },

    /** The user just proved it is them again (POST /auth/reauth/verify). Returns the new freshUntil. */
    async markFresh(sessionId: string): Promise<Date> {
      const at = now();
      await store.markFresh(sessionId, at, new Date(at.getTime() + STAFF_CHECK_MS));
      return freshUntil(at);
    },

    /** An editor or admin chose to keep this device: no admin check for STAFF_CHECK_KEPT_MS. */
    async keepStaffCheck(sessionId: string): Promise<void> {
      await store.keepStaffCheck(sessionId, new Date(now().getTime() + STAFF_CHECK_KEPT_MS));
    },

    /** The account's security changed (a passkey added or removed): every other device is signed out, this one stays. */
    async endOthers(userId: string, keepSessionId: string): Promise<void> {
      await store.removeOthers(userId, keepSessionId);
    },

    /** The owner said someone else got in: every device is signed out, this one too. */
    async endAll(userId: string): Promise<void> {
      await store.removeAll(userId);
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
