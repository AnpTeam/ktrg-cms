import type { Mailer } from "../lib/mailer";
import {
  OTP_COOLDOWN_MS,
  OTP_TTL_MS,
  generateOtpCode,
  hashOtpCode,
  normalizeEmail,
} from "./otp";

/** Storage the service needs; the Drizzle version is in otp-store.ts. */
export interface OtpStore {
  /** Expiry of the newest code issued to this email, or null if none. */
  latestExpiry(email: string): Promise<Date | null>;
  insert(row: { email: string; codeHash: string; expiresAt: Date }): Promise<void>;
}

export interface OtpServiceDeps {
  store: OtpStore;
  mailer: Mailer;
  secret: string;
  now?: () => Date;
  log?: (message: string) => void;
}

/**
 * Issues a login code by email. The caller always gets the same answer, so the
 * response never reveals whether a code was sent, throttled or failed.
 */
export function createOtpService({
  store,
  mailer,
  secret,
  now = () => new Date(),
  log = console.error,
}: OtpServiceDeps) {
  return {
    async request(rawEmail: string): Promise<void> {
      const email = normalizeEmail(rawEmail);
      const issuedAt = now();

      // The code's age is derived from its expiry: created = expiresAt - TTL.
      const latest = await store.latestExpiry(email);
      if (latest && latest.getTime() - OTP_TTL_MS + OTP_COOLDOWN_MS > issuedAt.getTime()) {
        return;
      }

      const code = generateOtpCode();
      await store.insert({
        email,
        codeHash: hashOtpCode(secret, email, code),
        expiresAt: new Date(issuedAt.getTime() + OTP_TTL_MS),
      });

      try {
        await mailer.send(buildOtpEmail(email, code));
      } catch (err) {
        // Never surface mail failures: it would tell a caller more than "ok".
        log(`[otp] mail send failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

export type OtpService = ReturnType<typeof createOtpService>;

/** Plain bilingual placeholder until the JA/EN templates (WBS 2.1.2) land. */
function buildOtpEmail(to: string, code: string) {
  const minutes = OTP_TTL_MS / 60_000;
  return {
    to,
    subject: "確認コード / Your verification code",
    text:
      `確認コード: ${code}\nこのコードは${minutes}分間有効です。心当たりがない場合は無視してください。\n\n` +
      `Your verification code: ${code}\nIt is valid for ${minutes} minutes. If you did not request it, ignore this email.`,
  };
}
