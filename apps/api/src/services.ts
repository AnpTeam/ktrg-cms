import type { AuditWriter } from "./audit/audit-log";
import { createOtpService, type OtpStore } from "./auth/otp-service";
import { createPasskeyService, type PasskeyConfig, type PasskeyStore } from "./auth/passkey-service";
import type { PasskeyServices } from "./auth/passkey-routes";
import { createRateLimiter, type RateLimitStore } from "./auth/rate-limit";
import type { AuthServices } from "./auth/routes";
import { createSessionService, type SessionStore } from "./auth/session-service";
import type { Mailer } from "./lib/mailer";
import type { MeServices } from "./me/me-routes";
import type { ContentServices } from "./content/admin-routes";
import { createContentService } from "./content/content-service";
import type { ContentStore } from "./content/content-types";
import { createMeService, type MeStore } from "./me/me-service";

/** Everything the routes use. */
export type Services = AuthServices & PasskeyServices & MeServices & ContentServices;

/** What the services are built from: the storage (database or in-memory) and the outside world. */
export interface ServiceDeps {
  stores: {
    otp: OtpStore;
    session: SessionStore;
    rateLimit: RateLimitStore;
    passkeys: PasskeyStore;
    me: MeStore;
    content: ContentStore;
  };
  audit: AuditWriter;
  /** Sends login codes and the passkey / deletion alerts. */
  mailer: Mailer;
  /** Key for hashing login codes and rate-limit identifiers. */
  secret: string;
  /** ADMIN_EMAILS, normalized: promoted to admin on an email-code login. */
  adminEmails?: ReadonlySet<string>;
  passkey: PasskeyConfig;
  /** The clock every service reads. Tests move it; the app uses real time. */
  now?: () => Date;
}

/**
 * Wire the services together. The app passes the Drizzle stores (app.ts); the dev page
 * passes in-memory ones (scripts/phone-test.ts). Same wiring, so both behave the same.
 */
export function createServices(deps: ServiceDeps): Services {
  const { stores, mailer, secret, now } = deps;
  return {
    otp: createOtpService({ store: stores.otp, mailer, secret, adminEmails: deps.adminEmails, now }),
    session: createSessionService({ store: stores.session, now }),
    rateLimit: createRateLimiter({ store: stores.rateLimit, secret, now }),
    audit: deps.audit,
    // Emails the owner when a passkey is added or removed.
    passkeys: createPasskeyService({ store: stores.passkeys, mailer, config: deps.passkey, now }),
    // Profile, language, display name and deletion requests (emails the owner).
    me: createMeService({ store: stores.me, mailer, now }),
    // Routes and places: what the admin edits and visitors read.
    content: createContentService({ store: stores.content }),
  };
}
