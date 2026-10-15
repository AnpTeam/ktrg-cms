import { describe, expect, test } from "bun:test";
import type { Mailer, MailMessage } from "../lib/mailer";
import { OTP_COOLDOWN_MS, OTP_TTL_MS, hashOtpCode } from "./otp";
import { createOtpService, type OtpStore } from "./otp-service";

const secret = "t".repeat(32);

function setup(opts: { mailFails?: boolean } = {}) {
  const rows: { email: string; codeHash: string; expiresAt: Date }[] = [];
  const sent: MailMessage[] = [];
  const logs: string[] = [];
  let clock = new Date("2026-10-15T00:00:00Z");

  const store: OtpStore = {
    async latestExpiry(email) {
      const mine = rows.filter((r) => r.email === email).map((r) => r.expiresAt.getTime());
      return mine.length ? new Date(Math.max(...mine)) : null;
    },
    async insert(row) {
      rows.push(row);
    },
  };
  const mailer: Mailer = {
    async send(m) {
      if (opts.mailFails) throw new Error("smtp down");
      sent.push(m);
    },
  };
  const service = createOtpService({ store, mailer, secret, now: () => clock, log: (m) => logs.push(m) });
  return { service, rows, sent, logs, advance: (ms: number) => (clock = new Date(clock.getTime() + ms)) };
}

describe("otp request", () => {
  test("stores a hash, emails the code, and sets a 10 minute expiry", async () => {
    const { service, rows, sent } = setup();
    await service.request("User@Example.com");

    expect(rows).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("user@example.com");

    const code = sent[0]!.text.match(/\d{6}/)![0];
    expect(rows[0]!.codeHash).toBe(hashOtpCode(secret, "user@example.com", code));
    expect(rows[0]!.codeHash).not.toContain(code);
    expect(rows[0]!.expiresAt.getTime()).toBe(new Date("2026-10-15T00:00:00Z").getTime() + OTP_TTL_MS);
  });

  test("a second request inside 60 s sends nothing and stores nothing", async () => {
    const { service, rows, sent, advance } = setup();
    await service.request("a@example.com");
    advance(OTP_COOLDOWN_MS - 1000);
    await service.request("A@example.com");
    expect(rows).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });

  test("a request after the cooldown issues a new code", async () => {
    const { service, rows, sent, advance } = setup();
    await service.request("a@example.com");
    advance(OTP_COOLDOWN_MS + 1000);
    await service.request("a@example.com");
    expect(rows).toHaveLength(2);
    expect(sent).toHaveLength(2);
  });

  test("the cooldown is per email", async () => {
    const { service, sent } = setup();
    await service.request("a@example.com");
    await service.request("b@example.com");
    expect(sent).toHaveLength(2);
  });

  test("a mail failure is logged, not thrown", async () => {
    const { service, logs } = setup({ mailFails: true });
    await expect(service.request("a@example.com")).resolves.toBeUndefined();
    expect(logs[0]).toContain("smtp down");
  });
});
