import { normalizeEmail } from "./otp";

const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/**
 * Parse ADMIN_EMAILS: a comma-separated list of addresses that become admin when they log
 * in with an email code. Entries are trimmed and lowercased like every other email; empty
 * entries (a trailing comma) are ignored, anything that is not an address is reported.
 */
export function parseAdminEmails(raw: string | undefined): { emails: Set<string>; invalid: string[] } {
  const emails = new Set<string>();
  const invalid: string[] = [];
  for (const entry of (raw ?? "").split(",")) {
    const email = normalizeEmail(entry);
    if (!email) continue;
    if (EMAIL.test(email)) emails.add(email);
    else invalid.push(entry.trim());
  }
  return { emails, invalid };
}
