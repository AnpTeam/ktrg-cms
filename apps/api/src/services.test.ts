import { describe, expect, test } from "bun:test";
import { createMemoryAuditWriter } from "./audit/audit-log";
import { createMemoryOtpStore } from "./auth/otp-memory-store";
import { createMemoryPasskeyStore } from "./auth/passkey-memory-store";
import { createMemoryRateLimitStore } from "./auth/rate-limit-memory-store";
import { createMemorySessionStore } from "./auth/session-memory-store";
import { createMemoryContentStore } from "./content/content-memory-store";
import { createMemoryMeStore } from "./me/me-memory-store";
import { createMemoryRallyAdminStore } from "./rallies/rally-admin-memory-store";
import { createServices } from "./services";

function build(photoHosts?: string[]) {
  const { store: otp, users } = createMemoryOtpStore();
  const audit = createMemoryAuditWriter();
  return createServices({
    stores: {
      otp,
      session: createMemorySessionStore(users).store,
      rateLimit: createMemoryRateLimitStore().store,
      passkeys: createMemoryPasskeyStore(users).store,
      me: createMemoryMeStore(users).store,
      content: createMemoryContentStore(audit.writer).store,
      rallyAdmin: createMemoryRallyAdminStore(audit.writer).store,
    },
    audit: audit.writer,
    mailer: { async send() {} },
    secret: "services-test-secret-services-test-0",
    passkey: { rpName: "KTRG", rpId: "example.com", origin: "https://example.com" },
    photoHosts,
  });
}

describe("createServices", () => {
  test("PHOTO_HOSTS reaches the content service: another host is refused, a listed one passes", async () => {
    const admin = "11111111-1111-4111-8111-111111111111";
    const limited = build(["photos.example.com"]);
    expect(await limited.content.createRoute(admin, { nameJa: "甲山", photoUrl: "https://elsewhere.example/a.jpg" })).toEqual({ ok: false, reason: "invalid_photo_url" });
    expect((await limited.content.createRoute(admin, { nameJa: "甲山", photoUrl: "https://photos.example.com/a.jpg" })).ok).toBe(true);
    expect((await build().content.createRoute(admin, { nameJa: "甲山", photoUrl: "https://elsewhere.example/a.jpg" })).ok).toBe(true);
  });
});
