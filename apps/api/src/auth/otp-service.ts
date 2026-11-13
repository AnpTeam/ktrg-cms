import type { AuthUser, Locale, NewAccountProfile } from "./user";
import { buildOtpEmail } from "../emails/otp-code";
import { buildReauthEmail } from "../emails/reauth-code";
import { mailFailure, type Mailer } from "../lib/mailer";
import {
  OTP_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  generateOtpCode,
  hashOtpCode,
  hashesMatch,
  normalizeEmail,
} from "./otp";

const OTP_PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

export interface OtpRow {
  id: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
}


/** Storage the service needs; the Drizzle version is in otp-store.ts. */
export interface OtpStore {
  /** The newest code issued to this email, or null if none. */
  latest(email: string): Promise<OtpRow | null>;
  insert(row: { email: string; codeHash: string; expiresAt: Date }): Promise<void>;
  /**
   * Adds the code unless this email already has one that expires after `recent` (one issued inside the cooldown). The check
   * and the insert are one step per email, so parallel requests cannot each add a code. Returns whether it was added.
   */
  insertUnlessRecent(row: { email: string; codeHash: string; expiresAt: Date }, recent: Date): Promise<boolean>;
  /** Delete every code that expired before this time (they hold an email address). */
  pruneExpired(before: Date): Promise<void>;
  /**
   * Atomically count one guess against an unused code. Returns false when the
   * code is already used or has no attempts left.
   */
  consumeAttempt(id: string, max: number): Promise<boolean>;
  /** Atomically mark a code used. Returns false if someone else already did. */
  markUsed(id: string, at: Date): Promise<boolean>;
  /**
   * The user with this email, created (participant) on first sight. `profile` (name, origin,
   * language) is applied only when the account is created here; an existing account is untouched.
   */
  findOrCreateUser(email: string, profile?: NewAccountProfile): Promise<AuthUser>;
  /**
   * Atomically make this user an admin and write the audit row. Returns false when they
   * already were one, or when an admin has ever set their role (user.role.change): nothing is written then.
   */
  promoteToAdmin(userId: string): Promise<boolean>;
  /**
   * Give a passkey-only account its first email, and write the audit row. Returns false when
   * the account already has one or another account owns this address (nothing is written then).
   */
  setUserEmail(userId: string, email: string): Promise<boolean>;
}

export interface OtpServiceDeps {
  store: OtpStore;
  mailer: Mailer;
  secret: string;
  /**
   * ADMIN_EMAILS, normalized. A listed address becomes admin on a successful code check:
   * the code proves they own the mailbox. Promote-only; nobody is ever demoted here.
   */
  adminEmails?: ReadonlySet<string>;
  now?: () => Date;
  log?: (message: string) => void;
}

export type VerifyResult = { ok: true; user: AuthUser } | { ok: false };

/**
 * Issues and checks login codes. Callers get no detail on why a check failed
 * (wrong, expired, used, locked or unknown email), so nothing can be probed.
 */
export function createOtpService({
  store,
  mailer,
  secret,
  adminEmails = new Set(),
  now = () => new Date(),
  log = console.error,
}: OtpServiceDeps) {
  /** The shared code check: newest code only, attempts counted first, single use. */
  async function checkCode(email: string, code: string): Promise<boolean> {
    const at = now();

    // Only the newest code counts: requesting a new one retires the old.
    const row = await store.latest(email);
    if (!row || row.usedAt || row.expiresAt.getTime() <= at.getTime()) return false;

    // Count the guess first, atomically, so parallel guesses cannot beat the limit.
    if (!(await store.consumeAttempt(row.id, OTP_MAX_ATTEMPTS))) return false;

    if (!hashesMatch(row.codeHash, hashOtpCode(secret, email, code))) return false;

    // Single use: only one concurrent caller can win this.
    return store.markUsed(row.id, at);
  }

  return {
    /**
     * Email a code. `locale` is the language of the page the code was asked from (or the
     * account's language); Japanese if unknown. `purpose` only picks the email's wording:
     * a login code and a fresh-login code are the same kind of proof (you can read this
     * mailbox), so they share one cooldown and one "newest code wins" rule.
     */
    async request(
      rawEmail: string,
      locale: Locale = "ja",
      purpose: "login" | "reauth" = "login",
    ): Promise<void> {
      const email = normalizeEmail(rawEmail);
      const issuedAt = now();

      // The code's age is derived from its expiry (created = expiresAt - TTL): a code that expires after `recent` was issued
      // inside the cooldown, and then nothing is stored or sent.
      const code = generateOtpCode();
      const added = await store.insertUnlessRecent(
        { email, codeHash: hashOtpCode(secret, email, code), expiresAt: new Date(issuedAt.getTime() + OTP_TTL_MS) },
        new Date(issuedAt.getTime() + OTP_TTL_MS - OTP_COOLDOWN_MS),
      );
      if (!added) return;
      // Tidy up codes that expired over a day ago: nobody needs them, and they hold an email.
      await store.pruneExpired(new Date(issuedAt.getTime() - OTP_PRUNE_AFTER_MS)).catch(() => {});

      try {
        const build = purpose === "reauth" ? buildReauthEmail : buildOtpEmail;
        await mailer.send(build({ to: email, locale, code, ttlMinutes: OTP_TTL_MS / 60_000 }));
      } catch (err) {
        // Never surface mail failures: it would tell a caller more than "ok".
        log(`[otp] mail send failed: ${mailFailure(err)}`);
      }
    },

    /**
     * Fresh-login re-check for an account that is already logged in: true when the code is
     * right. Same rules as login (newest code only, 5 guesses, single use), but it creates
     * and promotes nothing.
     */
    async checkCode(rawEmail: string, code: string): Promise<boolean> {
      return checkCode(normalizeEmail(rawEmail), code);
    },

    /** Add an email to a passkey-only account: the code proves the new mailbox is theirs. */
    async attachEmail(userId: string, rawEmail: string, code: string): Promise<"ok" | "bad_code" | "taken"> {
      const email = normalizeEmail(rawEmail);
      if (!(await checkCode(email, code))) return "bad_code";
      return (await store.setUserEmail(userId, email)) ? "ok" : "taken";
    },

    /** Log in with a code: the account is created on first success (with `profile`, if given). */
    async verify(rawEmail: string, code: string, profile?: NewAccountProfile): Promise<VerifyResult> {
      const email = normalizeEmail(rawEmail);
      if (!(await checkCode(email, code))) return { ok: false };

      const user = await store.findOrCreateUser(email, profile);
      if (user.role !== "admin" && adminEmails.has(email)) {
        if (await store.promoteToAdmin(user.id)) {
          log(`[auth] ${user.id} promoted to admin (ADMIN_EMAILS)`);
          return { ok: true, user: { ...user, role: "admin" } };
        }
        // Not promoted: an admin has set this account's role (it stays), or a parallel login just promoted it. Read it again.
        return { ok: true, user: await store.findOrCreateUser(email) };
      }
      return { ok: true, user };
    },
  };
}

export type OtpService = ReturnType<typeof createOtpService>;
