import { describe, expect, test } from "bun:test";
import type { Mailer, MailMessage } from "../lib/mailer";
import { OTP_COOLDOWN_MS, OTP_MAX_ATTEMPTS, OTP_TTL_MS, hashOtpCode } from "./otp";
import { createMemoryOtpStore } from "./otp-memory-store";
import { createOtpService } from "./otp-service";

const secret = "t".repeat(32);

function setup(opts: { mailFails?: boolean } = {}) {
  const { store, rows, users } = createMemoryOtpStore();
  const sent: MailMessage[] = [];
  const logs: string[] = [];
  let clock = new Date("2026-10-15T00:00:00Z");

  const mailer: Mailer = {
    async send(m) {
      if (opts.mailFails) throw new Error("smtp down");
      sent.push(m);
    },
  };
  const service = createOtpService({ store, mailer, secret, now: () => clock, log: (m) => logs.push(m) });
  const lastCode = () => sent.at(-1)!.text.match(/\d{6}/)![0];
  const wrongCode = () => (lastCode() === "000000" ? "111111" : "000000");
  return {
    service,
    rows,
    users,
    sent,
    logs,
    lastCode,
    wrongCode,
    advance: (ms: number) => (clock = new Date(clock.getTime() + ms)),
  };
}

describe("otp request", () => {
  test("stores a hash, emails the code, and sets a 10 minute expiry", async () => {
    const { service, rows, sent, lastCode } = setup();
    await service.request("User@Example.com");

    expect(rows).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("user@example.com");

    const code = lastCode();
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

describe("otp verify", () => {
  test("the right code logs in and creates the user on first success", async () => {
    const { service, users, lastCode } = setup();
    await service.request("New@Example.com");

    const result = await service.verify("new@example.com", lastCode());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user).toMatchObject({ email: "new@example.com", role: "participant", locale: "ja" });
    expect(users.size).toBe(1);
  });

  test("a returning user is not duplicated", async () => {
    const { service, users, lastCode, advance } = setup();
    await service.request("a@example.com");
    const first = await service.verify("a@example.com", lastCode());
    advance(OTP_COOLDOWN_MS + 1000);
    await service.request("a@example.com");
    const second = await service.verify("a@example.com", lastCode());

    expect(users.size).toBe(1);
    expect(first.ok && second.ok && first.user.id === second.user.id).toBe(true);
  });

  test("a code works once", async () => {
    const { service, lastCode } = setup();
    await service.request("a@example.com");
    const code = lastCode();
    expect((await service.verify("a@example.com", code)).ok).toBe(true);
    expect((await service.verify("a@example.com", code)).ok).toBe(false);
  });

  test("two parallel checks of the right code let only one in", async () => {
    const { service, lastCode } = setup();
    await service.request("a@example.com");
    const code = lastCode();
    const results = await Promise.all([service.verify("a@example.com", code), service.verify("a@example.com", code)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  test("a wrong code fails and creates no user", async () => {
    const { service, users, wrongCode } = setup();
    await service.request("a@example.com");
    expect((await service.verify("a@example.com", wrongCode())).ok).toBe(false);
    expect(users.size).toBe(0);
  });

  test("the code stops working after 5 attempts, even the right one", async () => {
    const { service, lastCode, wrongCode } = setup();
    await service.request("a@example.com");
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      expect((await service.verify("a@example.com", wrongCode())).ok).toBe(false);
    }
    expect((await service.verify("a@example.com", lastCode())).ok).toBe(false);
  });

  test("the right code on the 5th try still works", async () => {
    const { service, lastCode, wrongCode } = setup();
    await service.request("a@example.com");
    for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i++) await service.verify("a@example.com", wrongCode());
    expect((await service.verify("a@example.com", lastCode())).ok).toBe(true);
  });

  test("an expired code fails", async () => {
    const { service, lastCode, advance } = setup();
    await service.request("a@example.com");
    const code = lastCode();
    advance(OTP_TTL_MS + 1000);
    expect((await service.verify("a@example.com", code)).ok).toBe(false);
  });

  test("a new request retires the older code", async () => {
    const { service, lastCode, advance } = setup();
    await service.request("a@example.com");
    const oldCode = lastCode();
    advance(OTP_COOLDOWN_MS + 1000);
    await service.request("a@example.com");
    const newCode = lastCode();

    // (1 in a million the two random codes are equal, which would make this check moot.)
    if (oldCode !== newCode) expect((await service.verify("a@example.com", oldCode)).ok).toBe(false);
    expect((await service.verify("a@example.com", newCode)).ok).toBe(true);
  });

  test("an email with no code fails", async () => {
    const { service } = setup();
    expect((await service.verify("nobody@example.com", "123456")).ok).toBe(false);
  });

  test("a code for one email does not work for another", async () => {
    const { service, lastCode } = setup();
    await service.request("a@example.com");
    const codeForA = lastCode();
    await service.request("b@example.com");
    const codeForB = lastCode();

    if (codeForA !== codeForB) expect((await service.verify("a@example.com", codeForB)).ok).toBe(false);
    expect((await service.verify("b@example.com", codeForB)).ok).toBe(true);
  });
});
