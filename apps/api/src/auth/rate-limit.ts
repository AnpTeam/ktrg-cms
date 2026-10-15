import { createHmac } from "node:crypto";

export interface RateLimitRule {
  name: string;
  limit: number;
  windowMs: number;
}

/** Storage the limiter needs; the Drizzle version is in rate-limit-store.ts. */
export interface RateLimitStore {
  /** Atomically add one to the counter for this key and window; returns the new count. */
  hit(key: string, windowStart: Date): Promise<number>;
  /** Forget windows that started before this time. */
  prune(before: Date): Promise<void>;
}

const MINUTE = 60 * 1000;

/**
 * Limits for the auth endpoints, per email and per IP. They sit on top of the
 * per-code rules (60 s resend cooldown, 5 guesses per code).
 */
export const AUTH_LIMITS = {
  otpRequestEmail: { name: "otp-request-email", limit: 5, windowMs: 15 * MINUTE },
  otpRequestIp: { name: "otp-request-ip", limit: 20, windowMs: 15 * MINUTE },
  otpVerifyEmail: { name: "otp-verify-email", limit: 10, windowMs: 15 * MINUTE },
  otpVerifyIp: { name: "otp-verify-ip", limit: 30, windowMs: 15 * MINUTE },
  // Passkey sign-up creates an account with no email to throttle on. Generous, because
  // many people on one trailhead mobile network share an IP.
  passkeySignupIp: { name: "passkey-signup-ip", limit: 30, windowMs: 15 * MINUTE },
  // Passkey login needs no email, so the only handle is the caller's IP.
  passkeyLoginIp: { name: "passkey-login-ip", limit: 30, windowMs: 15 * MINUTE },
  // Keyed by user id: removing passkeys.
  passkeyRemoveUser: { name: "passkey-remove-user", limit: 10, windowMs: 15 * MINUTE },
  // Keyed by user id: adding a passkey needs a login, so this just caps abuse.
  passkeyRegisterUser: { name: "passkey-register-user", limit: 10, windowMs: 15 * MINUTE },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

const PRUNE_AFTER_MS = 24 * 60 * MINUTE;
const PRUNE_CHANCE = 0.05;

export function createRateLimiter({
  store,
  secret,
  now = () => new Date(),
  random = Math.random,
}: {
  store: RateLimitStore;
  secret: string;
  now?: () => Date;
  random?: () => number;
}) {
  async function check(rule: RateLimitRule, identifier: string): Promise<RateLimitResult> {
    const t = now().getTime();
    const windowStart = Math.floor(t / rule.windowMs) * rule.windowMs;
    // Hash the identifier so no email or IP address is stored in clear.
    const key = `${rule.name}:${createHmac("sha256", secret).update(identifier).digest("hex")}`;

    const count = await store.hit(key, new Date(windowStart));

    // Tidy up now and then, when a fresh window has just been created.
    if (count === 1 && random() < PRUNE_CHANCE) {
      await store.prune(new Date(t - PRUNE_AFTER_MS)).catch(() => {
        // Pruning is housekeeping: a failure must not block a login.
      });
    }

    if (count <= rule.limit) return { allowed: true };
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((windowStart + rule.windowMs - t) / 1000)) };
  }

  return {
    check,

    /** Count every hit (so no limit is skipped) and report the longest wait if any is exceeded. */
    async checkAll(hits: { rule: RateLimitRule; identifier: string }[]): Promise<RateLimitResult> {
      const results = await Promise.all(hits.map((h) => check(h.rule, h.identifier)));
      const blocked = results.filter((r) => !r.allowed);
      if (blocked.length === 0) return { allowed: true };
      return { allowed: false, retryAfterSec: Math.max(...blocked.map((r) => (r.allowed ? 0 : r.retryAfterSec))) };
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
