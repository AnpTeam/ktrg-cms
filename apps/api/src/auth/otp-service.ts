import type { EmailLocale } from "../emails/layout";
import { buildOtpEmail } from "../emails/otp-code";
import type { Mailer } from "../lib/mailer";
import {
  OTP_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  generateOtpCode,
  hashOtpCode,
  hashesMatch,
  normalizeEmail,
} from "./otp";

export interface OtpRow {
  id: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
}

export interface AuthUser {
  id: string;
  /** Null for an account made with a passkey alone: never assume you can email a user. */
  email: string | null;
  role: "participant" | "admin";
  locale: "ja" | "en";
}

/** Storage the service needs; the Drizzle version is in otp-store.ts. */
export interface OtpStore {
  /** The newest code issued to this email, or null if none. */
  latest(email: string): Promise<OtpRow | null>;
  insert(row: { email: string; codeHash: string; expiresAt: Date }): Promise<void>;
  /**
   * Atomically count one guess against an unused code. Returns false when the
   * code is already used or has no attempts left.
   */
  consumeAttempt(id: string, max: number): Promise<boolean>;
  /** Atomically mark a code used. Returns false if someone else already did. */
  markUsed(id: string, at: Date): Promise<boolean>;
  /** The user with this email, created (participant, ja) on first sight. */
  findOrCreateUser(email: string): Promise<AuthUser>;
  /**
   * Atomically make this user an admin and write the audit row. Returns false when they
   * already were one (nothing is written then).
   */
  promoteToAdmin(userId: string): Promise<boolean>;
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
  return {
    /** `locale` is the language of the page the code was asked from; Japanese if unknown. */
    async request(rawEmail: string, locale: EmailLocale = "ja"): Promise<void> {
      const email = normalizeEmail(rawEmail);
      const issuedAt = now();

      // The code's age is derived from its expiry: created = expiresAt - TTL.
      const latest = await store.latest(email);
      if (latest && latest.expiresAt.getTime() - OTP_TTL_MS + OTP_COOLDOWN_MS > issuedAt.getTime()) {
        return;
      }

      const code = generateOtpCode();
      await store.insert({
        email,
        codeHash: hashOtpCode(secret, email, code),
        expiresAt: new Date(issuedAt.getTime() + OTP_TTL_MS),
      });

      try {
        await mailer.send(buildOtpEmail({ to: email, locale, code, ttlMinutes: OTP_TTL_MS / 60_000 }));
      } catch (err) {
        // Never surface mail failures: it would tell a caller more than "ok".
        log(`[otp] mail send failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },

    async verify(rawEmail: string, code: string): Promise<VerifyResult> {
      const email = normalizeEmail(rawEmail);
      const at = now();

      // Only the newest code counts: requesting a new one retires the old.
      const row = await store.latest(email);
      if (!row || row.usedAt || row.expiresAt.getTime() <= at.getTime()) return { ok: false };

      // Count the guess first, atomically, so parallel guesses cannot beat the limit.
      if (!(await store.consumeAttempt(row.id, OTP_MAX_ATTEMPTS))) return { ok: false };

      if (!hashesMatch(row.codeHash, hashOtpCode(secret, email, code))) return { ok: false };

      // Single use: only one concurrent caller can win this.
      if (!(await store.markUsed(row.id, at))) return { ok: false };

      const user = await store.findOrCreateUser(email);
      if (user.role !== "admin" && adminEmails.has(email)) {
        if (await store.promoteToAdmin(user.id)) log(`[auth] ${user.id} promoted to admin (ADMIN_EMAILS)`);
        return { ok: true, user: { ...user, role: "admin" } };
      }
      return { ok: true, user };
    },
  };
}

export type OtpService = ReturnType<typeof createOtpService>;
