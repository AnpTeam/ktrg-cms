import { describe, expect, test } from "bun:test";
import type { AuthUser } from "./user";
import { createMemoryPasskeyStore } from "./passkey-memory-store";
import { CHALLENGE_TTL_MS, createPasskeyService } from "./passkey-service";
import { TestAuthenticator } from "./webauthn-test-authenticator";

const testProfile = { displayName: "Hiker", origin: null, locale: "ja" } as const;

const config = { rpName: "KTRG", rpId: "example.com", origin: "https://example.com" };
const alice: AuthUser = { id: "11111111-1111-1111-1111-111111111111", email: "alice@example.com", role: "participant", locale: "en" };

function setup() {
  const users = new Map<string, AuthUser>([[alice.id, alice]]);
  const mem = createMemoryPasskeyStore(users);
  let clock = new Date("2026-10-15T00:00:00Z");
  const service = createPasskeyService({ store: mem.store, config, now: () => clock });
  const phone = () => new TestAuthenticator({ origin: config.origin, rpId: config.rpId });

  /** Sign up with a passkey alone, returning the new account and the phone that holds its passkey. */
  async function signUp() {
    const p = phone();
    const options = await service.signupOptions();
    const result = await service.verifySignup(p.register(options), "My iPhone", testProfile);
    if (!result.ok) throw new Error("sign-up failed");
    return { phone: p, user: result.user, options };
  }

  return { service, phone, signUp, ...mem, advance: (ms: number) => (clock = new Date(clock.getTime() + ms)) };
}

describe("sign up with a passkey alone (no email)", () => {
  test("options need no login and describe an anonymous new account", async () => {
    const { service, challenges } = setup();
    const options = await service.signupOptions();

    expect(options.rp).toEqual({ name: "KTRG", id: "example.com" });
    expect(options.user.name).toMatch(/^ktrg-[0-9a-f]{8}$/); // nothing like an email
    expect(options.authenticatorSelection).toMatchObject({ residentKey: "required", userVerification: "required" });
    // Scan the face / fingerprint on this device and make a new key; do not go looking for a security key.
    expect(options.authenticatorSelection?.authenticatorAttachment).toBeUndefined();
    expect(options.hints ?? []).toEqual([]);
    expect(challenges).toHaveLength(1);
    expect(challenges[0]).toMatchObject({ type: "registration", userId: null });
    expect(challenges[0]!.expiresAt.getTime()).toBe(new Date("2026-10-15T00:00:00Z").getTime() + CHALLENGE_TTL_MS);
  });

  test("a good passkey creates an account with no email: participant, Japanese", async () => {
    const { signUp, users, passkeys, challenges } = setup();
    const { user, phone, options } = await signUp();

    expect(user).toEqual({ id: expect.any(String), email: null, role: "participant", locale: "ja" });
    // The id the phone was given is the id of the new account.
    expect(Buffer.from(options.user.id, "base64url").toString()).toBe(user.id);
    expect(users.get(user.id)).toEqual(user);
    expect(passkeys).toEqual([
      expect.objectContaining({ userId: user.id, credentialId: phone.id, counter: 0, label: "My iPhone" }),
    ]);
    expect(challenges).toHaveLength(0);
  });

  test("nothing is created until the passkey verifies", async () => {
    const { service, users } = setup();
    await service.signupOptions();
    expect(users.size).toBe(1); // only alice
  });

  test("two sign-ups are two separate accounts", async () => {
    const { signUp } = setup();
    const a = await signUp();
    const b = await signUp();
    expect(a.user.id).not.toBe(b.user.id);
  });

  test("replaying the same response creates nothing more", async () => {
    const { service, phone, users, passkeys } = setup();
    const response = phone().register(await service.signupOptions());

    expect((await service.verifySignup(response, null, testProfile)).ok).toBe(true);
    expect((await service.verifySignup(response, null, testProfile)).ok).toBe(false);
    expect(users.size).toBe(2);
    expect(passkeys).toHaveLength(1);
  });

  test("a wrong website creates no account", async () => {
    const { service, phone, users } = setup();
    const response = phone().register(await service.signupOptions(), { origin: "https://evil.example.net" });
    expect((await service.verifySignup(response, null, testProfile)).ok).toBe(false);
    expect(users.size).toBe(1);
  });

  test("no biometric check creates no account", async () => {
    const { service, phone, users } = setup();
    const response = phone().register(await service.signupOptions(), { userVerified: false });
    expect((await service.verifySignup(response, null, testProfile)).ok).toBe(false);
    expect(users.size).toBe(1);
  });

  test("an expired challenge creates no account", async () => {
    const { service, phone, users, advance } = setup();
    const response = phone().register(await service.signupOptions());
    advance(CHALLENGE_TTL_MS + 1000);
    expect((await service.verifySignup(response, null, testProfile)).ok).toBe(false);
    expect(users.size).toBe(1);
  });

  test("a made-up challenge creates no account", async () => {
    const { service, phone, users } = setup();
    const options = await service.signupOptions();
    const forged = phone().register(options, { challenge: Buffer.from("made-up-challenge-value-0123456789").toString("base64url") });
    expect((await service.verifySignup(forged, null, testProfile)).ok).toBe(false);
    expect(users.size).toBe(1);
  });

  test("an add-a-passkey challenge cannot be used to sign up", async () => {
    const { service, phone, users } = setup();
    const added = await service.registrationOptions(alice);
    if (!added.ok) throw new Error("options refused");

    expect((await service.verifySignup(phone().register(added.options), null, testProfile)).ok).toBe(false);
    expect(users.size).toBe(1);
  });

  test("a sign-up challenge cannot be used to add a passkey to someone else's account", async () => {
    const { service, phone, passkeys } = setup();
    const response = phone().register(await service.signupOptions());

    expect((await service.verifyRegistration(alice, response, null)).ok).toBe(false);
    expect(passkeys).toHaveLength(0);
  });

  test("a credential that already exists cannot start a second account", async () => {
    const { signUp, service, users } = setup();
    const { phone } = await signUp();
    const before = users.size;

    const again = await service.verifySignup(phone.register(await service.signupOptions()), null, testProfile);
    expect(again.ok).toBe(false);
    expect(users.size).toBe(before);
  });
});

describe("passkey login", () => {
  test("options name no account and ask for Face ID / fingerprint", async () => {
    const { service, challenges } = setup();
    const options = await service.loginOptions();

    expect(options.rpId).toBe("example.com");
    expect(options.userVerification).toBe("required");
    expect(options.allowCredentials ?? []).toEqual([]); // empty list = any passkey for this site
    expect(challenges[0]).toMatchObject({ type: "authentication", userId: null });
  });

  test("a passkey-only account logs in, with no email involved", async () => {
    const { service, signUp } = setup();
    const { phone, user } = await signUp();

    const result = await service.verifyLogin(phone.authenticate(await service.loginOptions()));

    expect(result).toEqual({ ok: true, user });
    if (result.ok) expect(result.user.email).toBeNull();
  });

  test("an email account that added a passkey logs in with it", async () => {
    const { service, phone: newPhone } = setup();
    const p = newPhone();
    const added = await service.registrationOptions(alice);
    if (!added.ok) throw new Error("options refused");
    await service.verifyRegistration(alice, p.register(added.options), null);

    const result = await service.verifyLogin(p.authenticate(await service.loginOptions()));
    expect(result).toEqual({ ok: true, user: alice });
  });

  test("remembers the new signature counter", async () => {
    const { service, signUp, passkeys } = setup();
    const { phone } = await signUp();

    await service.verifyLogin(phone.authenticate(await service.loginOptions(), { counter: 7 }));
    expect(passkeys[0]!.counter).toBe(7);
  });

  test("the challenge works once: replaying a login fails", async () => {
    const { service, signUp } = setup();
    const { phone } = await signUp();
    const response = phone.authenticate(await service.loginOptions());

    expect((await service.verifyLogin(response)).ok).toBe(true);
    expect((await service.verifyLogin(response)).ok).toBe(false);
  });

  test("an unknown passkey fails", async () => {
    const { service, phone } = setup();
    const stranger = phone();
    stranger.userHandle = Buffer.from(alice.id).toString("base64url");
    expect((await service.verifyLogin(stranger.authenticate(await service.loginOptions()))).ok).toBe(false);
  });

  test("a signature from a different key fails", async () => {
    const { service, signUp } = setup();
    const { phone } = await signUp();
    const forged = phone.authenticate(await service.loginOptions(), { signWithOtherKey: true });
    expect((await service.verifyLogin(forged)).ok).toBe(false);
  });

  test("a wrong website fails", async () => {
    const { service, signUp } = setup();
    const { phone } = await signUp();
    const response = phone.authenticate(await service.loginOptions(), { origin: "https://evil.example.net" });
    expect((await service.verifyLogin(response)).ok).toBe(false);
  });

  test("no biometric check fails", async () => {
    const { service, signUp } = setup();
    const { phone } = await signUp();
    const response = phone.authenticate(await service.loginOptions(), { userVerified: false });
    expect((await service.verifyLogin(response)).ok).toBe(false);
  });

  test("a passkey that claims to belong to another account fails", async () => {
    const { service, signUp } = setup();
    const { phone } = await signUp();
    const response = phone.authenticate(await service.loginOptions(), {
      userHandle: Buffer.from(alice.id).toString("base64url"),
    });
    expect((await service.verifyLogin(response)).ok).toBe(false);
  });

  test("an expired challenge fails", async () => {
    const { service, signUp, advance } = setup();
    const { phone } = await signUp();
    const response = phone.authenticate(await service.loginOptions());
    advance(CHALLENGE_TTL_MS + 1000);
    expect((await service.verifyLogin(response)).ok).toBe(false);
  });

  test("a challenge from registration cannot be used to log in", async () => {
    const { service, signUp } = setup();
    const { phone } = await signUp();
    const reg = await service.signupOptions();

    expect((await service.verifyLogin(phone.authenticate(reg))).ok).toBe(false);
  });

  test("a counter that goes backwards (a cloned key) fails", async () => {
    const { service, signUp } = setup();
    const { phone } = await signUp();

    expect((await service.verifyLogin(phone.authenticate(await service.loginOptions(), { counter: 5 }))).ok).toBe(true);
    expect((await service.verifyLogin(phone.authenticate(await service.loginOptions(), { counter: 3 }))).ok).toBe(false);
  });
});

describe("sign-up profile", () => {
  test("the name, origin and language given are kept on the new account", async () => {
    const { service, phone, profiles } = setup();
    const result = await service.verifySignup(phone().register(await service.signupOptions()), null, {
      displayName: "Hana",
      origin: "overseas",
      locale: "en",
    });
    if (!result.ok) throw new Error("sign-up failed");
    expect(result.user.locale).toBe("en");
    expect(profiles.get(result.user.id)).toEqual({ displayName: "Hana", origin: "overseas" });
  });
});
