import { describe, expect, test } from "bun:test";
import type { MailMessage } from "../lib/mailer";
import type { AuthUser } from "./user";
import { createMemoryPasskeyStore } from "./passkey-memory-store";
import { createPasskeyService } from "./passkey-service";
import { TestAuthenticator } from "./webauthn-test-authenticator";

const testProfile = { displayName: "Hiker", origin: null, locale: "ja" } as const;

const config = { rpName: "KTRG", rpId: "example.com", origin: "https://example.com" };
const alice: AuthUser = { id: "11111111-1111-1111-1111-111111111111", email: "alice@example.com", role: "participant", locale: "en" };
const taro: AuthUser = { id: "22222222-2222-2222-2222-222222222222", email: "taro@example.com", role: "participant", locale: "ja" };

function setup(opts: { mailFails?: boolean } = {}) {
  const users = new Map<string, AuthUser>([
    [alice.id, alice],
    [taro.id, taro],
  ]);
  const mem = createMemoryPasskeyStore(users);
  const sent: MailMessage[] = [];
  const logs: string[] = [];
  const service = createPasskeyService({
    store: mem.store,
    config,
    log: (m) => logs.push(m),
    mailer: {
      async send(m) {
        if (opts.mailFails) throw new Error("<a@example.com>: Recipient address rejected");
        sent.push(m);
      },
    },
  });
  const phone = () => new TestAuthenticator({ origin: config.origin, rpId: config.rpId });

  /** Add a passkey to an existing account, the normal way. */
  async function addPasskey(user: AuthUser, label: string | null = null) {
    const r = await service.registrationOptions(user);
    if (!r.ok) throw new Error("options refused");
    const res = await service.verifyRegistration(user, phone().register(r.options), label);
    if (!res.ok) throw new Error("registration failed");
  }
  /** A passkey-only account (no email), with its first passkey. */
  async function passkeyOnlyUser(): Promise<AuthUser> {
    const result = await service.verifySignup(phone().register(await service.signupOptions()), "first", testProfile);
    if (!result.ok) throw new Error("sign-up failed");
    return result.user;
  }

  return { service, sent, logs, phone, addPasskey, passkeyOnlyUser, ...mem };
}

describe("list", () => {
  test("shows only the user's own passkeys, with id, name and date", async () => {
    const { service, addPasskey } = setup();
    await addPasskey(alice, "My iPhone");
    await addPasskey(alice, null);
    await addPasskey(taro, "Taro's phone");

    const list = await service.list(alice);

    expect(list).toHaveLength(2);
    expect(list.map((p) => p.label)).toEqual(["My iPhone", null]);
    for (const p of list) {
      expect(Object.keys(p).sort()).toEqual(["createdAt", "id", "label"]);
      expect(p.createdAt).toBeInstanceOf(Date);
    }
  });

  test("an account with no passkeys has an empty list", async () => {
    expect(await setup().service.list(alice)).toEqual([]);
  });
});

describe("alert email on add", () => {
  test("emails the owner in their language with the passkey's name", async () => {
    const { addPasskey, sent } = setup();
    await addPasskey(alice, "My iPhone");
    await addPasskey(taro, "Taroのスマホ");

    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({ to: "alice@example.com", subject: "[KTRG] A passkey was added to your account" });
    expect(sent[0]!.text).toContain("Name: My iPhone");
    expect(sent[1]).toMatchObject({ to: "taro@example.com", subject: "【KTRG】パスキーが追加されました" });
  });

  test("a passkey-only account has no email, so nothing is sent", async () => {
    const { passkeyOnlyUser, addPasskey, sent } = setup();
    const user = await passkeyOnlyUser();
    await addPasskey(user, "second");
    expect(sent).toHaveLength(0);
  });

  test("signing up does not send an alert", async () => {
    const { passkeyOnlyUser, sent } = setup();
    await passkeyOnlyUser();
    expect(sent).toHaveLength(0);
  });

  test("a mail failure is logged and the passkey is still added", async () => {
    const { service, addPasskey, logs } = setup({ mailFails: true });
    await addPasskey(alice, "My iPhone");
    expect(await service.list(alice)).toHaveLength(1);
    expect(logs[0]).toContain("Error");
    expect(logs.join(" ")).not.toContain("example.com"); // the mail server's message can echo the address
  });

  test("a failed registration sends no alert", async () => {
    const { service, phone, sent } = setup();
    const r = await service.registrationOptions(alice);
    if (!r.ok) throw new Error("options refused");
    await service.verifyRegistration(alice, phone().register(r.options, { origin: "https://evil.example.net" }), null);
    expect(sent).toHaveLength(0);
  });
});

describe("remove", () => {
  test("removes the passkey and emails the owner", async () => {
    const { service, addPasskey, sent } = setup();
    await addPasskey(alice, "Old laptop");
    await addPasskey(alice, "Phone");
    sent.length = 0;
    const target = (await service.list(alice))[0]!;

    expect(await service.remove(alice, target.id)).toEqual({ ok: true });

    expect((await service.list(alice)).map((p) => p.label)).toEqual(["Phone"]);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "alice@example.com", subject: "[KTRG] A passkey was removed from your account" });
    expect(sent[0]!.text).toContain("Name: Old laptop");
  });

  test("someone else's passkey cannot be removed, and looks like it does not exist", async () => {
    const { service, addPasskey, sent } = setup();
    await addPasskey(taro, "Taro's phone");
    sent.length = 0;
    const taros = (await service.list(taro))[0]!;

    expect(await service.remove(alice, taros.id)).toEqual({ ok: false, reason: "not_found" });
    expect(await service.list(taro)).toHaveLength(1);
    expect(sent).toHaveLength(0);
  });

  test("an unknown id is not found", async () => {
    const { service } = setup();
    expect(await service.remove(alice, "33333333-3333-3333-3333-333333333333")).toEqual({ ok: false, reason: "not_found" });
  });

  test("an account with an email may remove its last passkey", async () => {
    const { service, addPasskey } = setup();
    await addPasskey(alice, "Only one");
    const [only] = await service.list(alice);
    expect(await service.remove(alice, only!.id)).toEqual({ ok: true });
    expect(await service.list(alice)).toEqual([]);
  });

  test("a passkey-only account cannot remove its last passkey (it would be locked out)", async () => {
    const { service, passkeyOnlyUser } = setup();
    const user = await passkeyOnlyUser();
    const [only] = await service.list(user);

    expect(await service.remove(user, only!.id)).toEqual({ ok: false, reason: "last_method" });
    expect(await service.list(user)).toHaveLength(1);
  });

  test("a passkey-only account may remove one when it has another", async () => {
    const { service, passkeyOnlyUser, addPasskey } = setup();
    const user = await passkeyOnlyUser();
    await addPasskey(user, "second");
    const [first] = await service.list(user);

    expect(await service.remove(user, first!.id)).toEqual({ ok: true });
    expect(await service.list(user)).toHaveLength(1);
  });

  test("removing the last two at once still leaves one", async () => {
    const { service, passkeyOnlyUser, addPasskey } = setup();
    const user = await passkeyOnlyUser();
    await addPasskey(user, "second");
    const [a, b] = await service.list(user);

    const results = await Promise.all([service.remove(user, a!.id), service.remove(user, b!.id)]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await service.list(user)).toHaveLength(1);
  });

  test("a mail failure is logged and the passkey is still removed", async () => {
    const { service, addPasskey, logs } = setup({ mailFails: true });
    await addPasskey(alice, "x");
    const [p] = await service.list(alice);
    expect(await service.remove(alice, p!.id)).toEqual({ ok: true });
    expect(await service.list(alice)).toEqual([]);
    expect(logs.length).toBeGreaterThan(0);
  });
});
