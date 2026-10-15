import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/** A code is valid for 10 minutes and may be re-requested after 60 seconds. */
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_COOLDOWN_MS = 60 * 1000;
/** Guesses allowed per code (the correct guess counts too). */
export const OTP_MAX_ATTEMPTS = 5;

/** Emails are compared case-insensitively; store and hash the lowercase form. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Six digits from the OS CSPRNG, zero-padded (000000 to 999999). */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** HMAC-SHA256 of the code, bound to the email. Only this hash is stored. */
export function hashOtpCode(secret: string, email: string, code: string): string {
  return createHmac("sha256", secret).update(`${normalizeEmail(email)}:${code}`).digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function hashesMatch(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}
