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
  // Keyed by user id: proving it is you again with a passkey (each try asks the phone for a face or fingerprint).
  passkeyReauthUser: { name: "passkey-reauth-user", limit: 10, windowMs: 15 * MINUTE },
  // Keyed by user id: deletion requests and cancels. Each request emails the owner, so a
  // request/cancel loop must not be able to flood their inbox.
  meDeletionUser: { name: "me-deletion-user", limit: 5, windowMs: 15 * MINUTE },
  // Keyed by user id: collecting stamps. Walkers stamp a handful of places an hour; this stops a script.
  stampUser: { name: "stamp-user", limit: 30, windowMs: 15 * MINUTE },
  // Keyed by user id: walking paths for navigation off the course line. OpenRouteService has a daily allowance shared by
  // everyone; the screen asks at most every 30 s while off the line, so 20 per 15 minutes is a walker, not a script.
  navigationPathUser: { name: "navigation-path-user", limit: 20, windowMs: 15 * MINUTE },
  // Keyed by user id, per day: one account cannot take most of the site's shared OpenRouteService allowance.
  navigationPathDaily: { name: "navigation-path-daily", limit: 200, windowMs: 24 * 60 * MINUTE },
  // Keyed by user id: an admin saving routes and places. Generous, because the editor saves often.
  adminWriteUser: { name: "admin-write-user", limit: 300, windowMs: 15 * MINUTE },
  // Keyed by user id: photo uploads (each is at most 4 MB). Enough for a gallery, not for filling the bucket.
  adminUploadUser: { name: "admin-upload-user", limit: 60, windowMs: 15 * MINUTE },
  // Keyed by user id: signing video uploads (each can be 200 MB, so 10 is about 2 GB at most).
  adminVideoUser: { name: "admin-video-user", limit: 10, windowMs: 15 * MINUTE },
  // Keyed by user id: opening the photo library (each open reads the bucket's file list).
  adminLibraryUser: { name: "admin-library-user", limit: 30, windowMs: 15 * MINUTE },
  // Keyed by user id: saving the own profile (language, name, preferences); the settings screen saves as things are changed.
  meProfileUser: { name: "me-profile-user", limit: 30, windowMs: 15 * MINUTE },
  // Keyed by user id: asking the route-finding service to snap a line to trails. The service has a daily allowance
  // (and may bill beyond it), so a slip or a script cannot use it all up.
  adminRoutingUser: { name: "admin-routing-user", limit: 40, windowMs: 15 * MINUTE },
  // One count for everyone (see withDailyCap): OpenRouteService's free allowance is about 2,000 calls a day, shared by every
  // visitor's navigation and the admin's snap, so a busy day or a script making accounts cannot use it all up.
  routingDaily: { name: "routing-daily", limit: 1500, windowMs: 24 * 60 * MINUTE },
  // One count for everyone: visitors' navigation may use at most this much of routingDaily, so accounts made to flood
  // navigation cannot leave the admin's "snap to trails" with nothing (it always keeps the other 500).
  navigationAllDaily: { name: "navigation-all-daily", limit: 1000, windowMs: 24 * 60 * MINUTE },
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
