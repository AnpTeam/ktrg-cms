import { describe, expect, test } from "bun:test";
import type { AuthUser } from "./user";
import { createMemoryPasskeyStore } from "./passkey-memory-store";
import { CHALLENGE_TTL_MS, MAX_PASSKEYS_PER_USER, createPasskeyService } from "./passkey-service";
import { TestAuthenticator } from "./webauthn-test-authenticator";

const config = { rpName: "KTRG", rpId: "example.com", origin: "https://example.com" };
const alice: AuthUser = { id: "11111111-1111-1111-1111-111111111111", email: "alice@example.com", role: "participant", locale: "ja" };
const bob: AuthUser = { id: "22222222-2222-2222-2222-222222222222", email: "bob@example.com", role: "participant", locale: "en" };

function setup() {
  const mem = createMemoryPasskeyStore();
  let clock = new Date("2026-10-15T00:00:00Z");
  const service = createPasskeyService({ store: mem.store, config, now: () => clock });
  const phone = () => new TestAuthenticator({ origin: config.origin, rpId: config.rpId });
  return { service, ...mem, phone, advance: (ms: number) => (clock = new Date(clock.getTime() + ms)) };
}

async function optionsFor(service: ReturnType<typeof setup>["service"], user: AuthUser) {
  const r = await service.registrationOptions(user);
  if (!r.ok) throw new Error("options refused");
  return r.options;
}

describe("registrationOptions", () => {
  test("describes our site and the user, and asks for a Face ID style check", async () => {
    const { service } = setup();
    const options = await optionsFor(service, alice);

    expect(options.rp).toEqual({ name: "KTRG", id: "example.com" });
    expect(options.user.name).toBe("alice@example.com");
    expect(options.authenticatorSelection).toMatchObject({ residentKey: "required", userVerification: "required" });
    expect(options.attestation).toBe("none");
    expect(options.authenticatorSelection?.authenticatorAttachment).toBe("platform");
    expect(options.hints).toEqual(["client-device"]);
    expect(options.challenge.length).toBeGreaterThanOrEqual(32);
  });

  test("the phone-side user id is the account id, not the email", async () => {
    const { service } = setup();
    const options = await optionsFor(service, alice);
    const handle = Buffer.from(options.user.id, "base64url").toString();
    expect(handle).toBe(alice.id);
    expect(handle).not.toContain("@");
  });

  test("remembers the challenge for 5 minutes", async () => {
    const { service, challenges } = setup();
    const options = await optionsFor(service, alice);

    expect(challenges).toHaveLength(1);
    expect(challenges[0]).toMatchObject({ challenge: options.challenge, type: "registration", userId: alice.id });
    expect(challenges[0]!.expiresAt.getTime()).toBe(new Date("2026-10-15T00:00:00Z").getTime() + CHALLENGE_TTL_MS);
  });

  test("every call gets a new challenge", async () => {
    const { service } = setup();
    const a = await optionsFor(service, alice);
    const b = await optionsFor(service, alice);
    expect(a.challenge).not.toBe(b.challenge);
  });

  test("lists the user's existing passkeys so the same device is not added twice", async () => {
    const { service, phone } = setup();
    const p = phone();
    const options = await optionsFor(service, alice);
    await service.verifyRegistration(alice, p.register(options), null);

    const next = await optionsFor(service, alice);
    expect(next.excludeCredentials?.map((c) => c.id)).toEqual([p.id]);
  });

  test("refuses beyond the per-account maximum", async () => {
    const { service, phone } = setup();
    for (let i = 0; i < MAX_PASSKEYS_PER_USER; i++) {
      const options = await optionsFor(service, alice);
      expect((await service.verifyRegistration(alice, phone().register(options), null)).ok).toBe(true);
    }
    expect(await service.registrationOptions(alice)).toEqual({ ok: false, reason: "too_many" });
  });

  test("prunes challenges that expired unused", async () => {
    const { service, challenges, advance } = setup();
    await optionsFor(service, alice);
    advance(CHALLENGE_TTL_MS + 1000);
    await optionsFor(service, bob);
    expect(challenges.map((c) => c.userId)).toEqual([bob.id]);
  });
});

describe("verifyRegistration", () => {
  test("a genuine registration stores the public key, counter and label", async () => {
    const { service, phone, passkeys } = setup();
    const p = phone();
    const options = await optionsFor(service, alice);

    const result = await service.verifyRegistration(alice, p.register(options), "My iPhone");

    expect(result).toEqual({ ok: true, passkey: { id: passkeys[0]!.id, credentialId: p.id, label: "My iPhone" } });
    expect(passkeys).toHaveLength(1);
    expect(passkeys[0]).toMatchObject({ userId: alice.id, credentialId: p.id, counter: 0, label: "My iPhone" });
    expect(passkeys[0]!.publicKey.length).toBeGreaterThan(0);
  });

  test("the challenge works once: replaying the same response fails", async () => {
    const { service, phone, passkeys } = setup();
    const response = phone().register(await optionsFor(service, alice));

    expect((await service.verifyRegistration(alice, response, null)).ok).toBe(true);
    expect((await service.verifyRegistration(alice, response, null)).ok).toBe(false);
    expect(passkeys).toHaveLength(1);
  });

  test("a challenge we never issued is rejected", async () => {
    const { service, phone, passkeys } = setup();
    const options = await optionsFor(service, alice);
    const forged = phone().register(options, { challenge: Buffer.from("made-up-challenge-value-0123456789").toString("base64url") });

    expect((await service.verifyRegistration(alice, forged, null)).ok).toBe(false);
    expect(passkeys).toHaveLength(0);
  });

  test("an expired challenge is rejected", async () => {
    const { service, phone, advance } = setup();
    const response = phone().register(await optionsFor(service, alice));
    advance(CHALLENGE_TTL_MS + 1000);
    expect((await service.verifyRegistration(alice, response, null)).ok).toBe(false);
  });

  test("someone else's challenge cannot be used", async () => {
    const { service, phone, passkeys } = setup();
    const aliceOptions = await optionsFor(service, alice);
    const response = phone().register(aliceOptions);

    expect((await service.verifyRegistration(bob, response, null)).ok).toBe(false);
    expect(passkeys).toHaveLength(0);
    // Bob's failed attempt did not use up Alice's challenge.
    expect((await service.verifyRegistration(alice, response, null)).ok).toBe(true);
  });

  test("a registration from the wrong website is rejected", async () => {
    const { service, phone, passkeys } = setup();
    const options = await optionsFor(service, alice);
    const response = phone().register(options, { origin: "https://evil.example.net" });

    expect((await service.verifyRegistration(alice, response, null)).ok).toBe(false);
    expect(passkeys).toHaveLength(0);
  });

  test("a passkey made for another domain is rejected", async () => {
    const { service, phone } = setup();
    const options = await optionsFor(service, alice);
    const response = phone().register(options, { rpId: "evil.example.net" });
    expect((await service.verifyRegistration(alice, response, null)).ok).toBe(false);
  });

  test("a device that did not check Face ID / fingerprint is rejected", async () => {
    const { service, phone } = setup();
    const options = await optionsFor(service, alice);
    const response = phone().register(options, { userVerified: false });
    expect((await service.verifyRegistration(alice, response, null)).ok).toBe(false);
  });

  test("a garbled response is rejected, not thrown", async () => {
    const { service, phone } = setup();
    const response = phone().register(await optionsFor(service, alice));
    response.response.attestationObject = "AAAA";
    expect((await service.verifyRegistration(alice, response, null)).ok).toBe(false);
  });

  test("a credential already registered (to anyone) cannot be registered again", async () => {
    const { service, phone, passkeys } = setup();
    const p = phone();
    expect((await service.verifyRegistration(alice, p.register(await optionsFor(service, alice)), null)).ok).toBe(true);

    const again = await service.verifyRegistration(bob, p.register(await optionsFor(service, bob)), null);
    expect(again.ok).toBe(false);
    expect(passkeys).toHaveLength(1);
    expect(passkeys[0]!.userId).toBe(alice.id);
  });
});
