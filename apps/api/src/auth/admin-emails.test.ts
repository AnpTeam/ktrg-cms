import { describe, expect, test } from "bun:test";
import type { Mailer } from "../lib/mailer";
import { parseAdminEmails } from "./admin-emails";
import { createMemoryOtpStore } from "./otp-memory-store";
import { createOtpService } from "./otp-service";

describe("parseAdminEmails", () => {
  test("unset or empty means nobody", () => {
    expect(parseAdminEmails(undefined).emails.size).toBe(0);
    expect(parseAdminEmails("").emails.size).toBe(0);
    expect(parseAdminEmails(" , ,").emails.size).toBe(0);
  });

  test("trims, lowercases and ignores empty entries", () => {
    const { emails, invalid } = parseAdminEmails(" Owner@Example.com ,second@example.org,, ");
    expect([...emails]).toEqual(["owner@example.com", "second@example.org"]);
    expect(invalid).toEqual([]);
  });

  test("reports anything that is not an address", () => {
    expect(parseAdminEmails("ok@example.com, nope, a b@example.com").invalid).toEqual(["nope", "a b@example.com"]);
  });
});

describe("first admin from ADMIN_EMAILS on email-code login", () => {
  function setup(adminEmails: string) {
    const { store, users, promotions } = createMemoryOtpStore();
    const sent: string[] = [];
    const logs: string[] = [];
    const mailer: Mailer = {
      async send(m) {
        sent.push(m.text.match(/\d{6}/)![0]);
      },
    };
    let clock = new Date("2026-10-15T00:00:00Z");
    const service = createOtpService({
      store,
      mailer,
      secret: "a".repeat(32),
      adminEmails: parseAdminEmails(adminEmails).emails,
      now: () => clock,
      log: (l) => logs.push(l),
    });
    async function login(email: string) {
      await service.request(email);
      const result = await service.verify(email, sent.at(-1)!);
      clock = new Date(clock.getTime() + 2 * 60_000); // past the resend cooldown
      return result;
    }
    return { service, login, sent, users, promotions, logs };
  }

  test("a listed address becomes admin on its first login", async () => {
    const { login, users, promotions, logs } = setup("owner@example.com");
    const result = await login("Owner@Example.com");

    expect(result).toMatchObject({ ok: true, user: { email: "owner@example.com", role: "admin" } });
    expect(users.get("owner@example.com")!.role).toBe("admin");
    expect(promotions).toHaveLength(1);
    expect(logs.some((l) => l.includes("promoted to admin"))).toBe(true);
  });

  test("an address not on the list stays a participant", async () => {
    const { login, promotions } = setup("owner@example.com");
    expect(await login("someone@example.com")).toMatchObject({ ok: true, user: { role: "participant" } });
    expect(promotions).toHaveLength(0);
  });

  test("with no list, nobody is promoted", async () => {
    const { login, promotions } = setup("");
    expect(await login("owner@example.com")).toMatchObject({ ok: true, user: { role: "participant" } });
    expect(promotions).toHaveLength(0);
  });

  test("an existing participant is promoted the next time they log in", async () => {
    const { login, users } = setup("owner@example.com");
    users.set("owner@example.com", { id: "u1", email: "owner@example.com", role: "participant", locale: "en" });
    expect(await login("owner@example.com")).toMatchObject({ ok: true, user: { id: "u1", role: "admin", locale: "en" } });
  });

  test("logging in again does not promote (or audit) twice", async () => {
    const { login, promotions } = setup("owner@example.com");
    await login("owner@example.com");
    const again = await login("owner@example.com");
    expect(again).toMatchObject({ ok: true, user: { role: "admin" } });
    expect(promotions).toHaveLength(1);
  });

  test("a wrong code promotes nobody", async () => {
    const { service, sent, users, promotions } = setup("owner@example.com");
    await service.request("owner@example.com");
    const wrong = sent.at(-1) === "000000" ? "111111" : "000000";
    expect(await service.verify("owner@example.com", wrong)).toEqual({ ok: false });
    expect(users.size).toBe(0);
    expect(promotions).toHaveLength(0);
  });
});
