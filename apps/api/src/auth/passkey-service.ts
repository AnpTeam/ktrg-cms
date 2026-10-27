import { randomUUID } from "node:crypto";
import { mailFailure, type Mailer } from "../lib/mailer";
import { buildPasskeyAlertEmail, type PasskeyAlertAction } from "../emails/passkey-alert";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { AuthUser, NewAccountProfile } from "./user";

/** A passkey ceremony must finish within this long. */
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
/** Most passkeys one account may hold. */
export const MAX_PASSKEYS_PER_USER = 10;

export type ChallengeType = "registration" | "authentication";

export interface StoredPasskey {
  userId: string;
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
}

export interface NewPasskey {
  userId: string;
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  label: string | null;
}

/** What the settings screen may show about a passkey: never the key material. */
export interface PasskeySummary {
  id: string;
  label: string | null;
  createdAt: Date;
}

export type RemoveStoreResult =
  | { ok: true; label: string | null }
  | { ok: false; reason: "not_found" | "last_method" };

/** Storage the passkey service needs; the Drizzle version is in passkey-store.ts. */
export interface PasskeyStore {
  /** The user's passkeys, oldest first. */
  list(userId: string): Promise<PasskeySummary[]>;
  /**
   * Remove one of THIS user's passkeys (another user's id is "not_found"). With
   * keepAtLeastOne, refuses to remove the last one. Atomic, so two removals at once
   * cannot both slip past that rule.
   */
  remove(userId: string, passkeyId: string, opts: { keepAtLeastOne: boolean }): Promise<RemoveStoreResult>;
  /** The stored passkey for a credential id, or null. */
  findCredential(credentialId: string): Promise<StoredPasskey | null>;
  /** Remember how many times the authenticator says it has been used (clone detection). */
  updateCounter(credentialId: string, counter: number): Promise<void>;
  userById(userId: string): Promise<AuthUser | null>;
  /** Credential ids the user already has (so the same device is not added twice). */
  credentialIds(userId: string): Promise<string[]>;
  saveChallenge(row: {
    challenge: string;
    type: ChallengeType;
    /** Whose challenge it is; null for login and for sign-up (no account yet). */
    userId: string | null;
    /** Sign-up only: the id the new account will get once the passkey verifies. */
    pendingUserId: string | null;
    expiresAt: Date;
  }): Promise<void>;
  /**
   * Atomically take (delete) an unexpired challenge of this type that belongs to
   * this user (or to nobody, when userId is null). Returns null if it is unknown,
   * expired, someone else's or already used.
   */
  takeChallenge(
    challenge: string,
    type: ChallengeType,
    userId: string | null,
    now: Date,
  ): Promise<{ pendingUserId: string | null } | null>;
  /** Forget challenges that expired before this time. */
  pruneChallenges(before: Date): Promise<void>;
  /** The new passkey's id, or null if the credential id is already registered. */
  insertPasskey(row: NewPasskey): Promise<string | null>;
  /**
   * Create a passkey-only account (no email) together with its first passkey, all
   * or nothing. Returns false, creating nothing, if the credential id is already taken.
   */
  createUserWithPasskey(row: NewPasskey & { profile: NewAccountProfile }): Promise<boolean>;
}

export interface PasskeyConfig {
  /** Shown in the phone's prompt. */
  rpName: string;
  /** The site's domain, e.g. "example.com". Passkeys only work on this domain. */
  rpId: string;
  /** The exact web origin, e.g. "https://example.com". */
  origin: string;
}

export type RegisterResult =
  | { ok: true; passkey: { id: string; credentialId: string; label: string | null } }
  | { ok: false; reason: "too_many" | "failed" };

export type LoginResult = { ok: true; user: AuthUser } | { ok: false };

export type RemoveResult = { ok: true } | { ok: false; reason: "not_found" | "last_method" };

export function createPasskeyService({
  store,
  config,
  now = () => new Date(),
  mailer,
  log = console.error,
}: {
  store: PasskeyStore;
  config: PasskeyConfig;
  now?: () => Date;
  /** Sends the add/remove alert. Without one, no alert is sent. */
  mailer?: Mailer;
  log?: (message: string) => void;
}) {
  /** Tell the account owner by email. Accounts with no email are skipped; a failure never blocks the action. */
  async function alert(user: AuthUser, action: PasskeyAlertAction, label: string | null) {
    if (!mailer || !user.email) return;
    try {
      await mailer.send(buildPasskeyAlertEmail({ to: user.email, locale: user.locale, action, label, at: now() }));
    } catch (err) {
      log(`[passkey] alert email failed: ${mailFailure(err)}`);
    }
  }

  /**
   * Make a NEW key on this device by scanning a face or fingerprint (Face ID, Touch ID,
   * Windows Hello), instead of asking the user to find a security key or another device.
   * It is a discoverable passkey, so login needs no email.
   */
  const registrationPrefs = {
    authenticatorSelection: { residentKey: "required", userVerification: "required", authenticatorAttachment: "platform" },
    // Also tells browsers that support it to go straight to the built-in scanner.
    preferredAuthenticatorType: "localDevice",
  } as const;
  // The library edits the object it is given, so every call gets its own copy.
  const registrationSettings = () =>
    ({
      authenticatorSelection: { ...registrationPrefs.authenticatorSelection },
      preferredAuthenticatorType: registrationPrefs.preferredAuthenticatorType,
    }) as const;

  async function newChallenge(row: {
    challenge: string;
    type: ChallengeType;
    userId: string | null;
    pendingUserId: string | null;
  }) {
    const at = now();
    await store.saveChallenge({ ...row, expiresAt: new Date(at.getTime() + CHALLENGE_TTL_MS) });
    // Tidy up challenges nobody finished.
    await store.pruneChallenges(at).catch(() => {});
  }

  return {
    /** Add a passkey to an account you are logged into. Step 1: settings plus a one-time challenge. */
    async registrationOptions(
      user: AuthUser,
    ): Promise<{ ok: true; options: PublicKeyCredentialCreationOptionsJSON } | { ok: false; reason: "too_many" }> {
      const existing = await store.credentialIds(user.id);
      if (existing.length >= MAX_PASSKEYS_PER_USER) return { ok: false, reason: "too_many" };

      const options = await generateRegistrationOptions({
        rpName: config.rpName,
        rpID: config.rpId,
        // Shown in the phone's passkey list. A passkey-only account has no email to show.
        userName: user.email ?? `ktrg-${user.id.slice(0, 8)}`,
        // An opaque id, never the email: the phone stores it with the passkey.
        userID: new TextEncoder().encode(user.id),
        attestationType: "none",
        excludeCredentials: existing.map((id) => ({ id })),
        ...registrationSettings(),
      });

      await newChallenge({ challenge: options.challenge, type: "registration", userId: user.id, pendingUserId: null });
      return { ok: true, options };
    },

    /** Add a passkey, step 3: check the phone's answer and keep the public key. */
    async verifyRegistration(
      user: AuthUser,
      response: RegistrationResponseJSON,
      label: string | null,
    ): Promise<RegisterResult> {
      if ((await store.credentialIds(user.id)).length >= MAX_PASSKEYS_PER_USER) {
        return { ok: false, reason: "too_many" };
      }

      const credential = await verifyNewCredential(response, async (challenge) =>
        (await store.takeChallenge(challenge, "registration", user.id, now())) !== null,
      );
      if (!credential) return { ok: false, reason: "failed" };

      const id = await store.insertPasskey({ userId: user.id, ...credential, label });
      if (!id) return { ok: false, reason: "failed" };

      await alert(user, "added", label);
      return { ok: true, passkey: { id, credentialId: credential.credentialId, label } };
    },

    /** The account's passkeys, for the settings screen. */
    list(user: AuthUser): Promise<PasskeySummary[]> {
      return store.list(user.id);
    },

    /**
     * Remove one of the user's own passkeys. A passkey-only account (no email) cannot remove
     * its last one: it would have no way to log in again.
     */
    async remove(user: AuthUser, passkeyId: string): Promise<RemoveResult> {
      const result = await store.remove(user.id, passkeyId, { keepAtLeastOne: user.email === null });
      if (!result.ok) return result;
      await alert(user, "removed", result.label);
      return { ok: true };
    },

    /**
     * Fresh login with a passkey, step 1: ask the phone to prove it is the owner again (face, fingerprint or the
     * device's own lock code). Only this account's passkeys are offered. `null` when the account has none.
     */
    async reauthOptions(user: AuthUser): Promise<PublicKeyCredentialRequestOptionsJSON | null> {
      const ids = await store.credentialIds(user.id);
      if (ids.length === 0) return null;
      const options = await generateAuthenticationOptions({
        rpID: config.rpId,
        userVerification: "required",
        allowCredentials: ids.map((id) => ({ id })),
      });
      await newChallenge({ challenge: options.challenge, type: "authentication", userId: user.id, pendingUserId: null });
      return options;
    },

    /** Fresh login with a passkey, step 3: the signature must come from one of THIS account's own passkeys. */
    async verifyReauth(user: AuthUser, response: AuthenticationResponseJSON): Promise<boolean> {
      const stored = await store.findCredential(response.id);
      if (!stored || stored.userId !== user.id) return false;
      try {
        const verification = await verifyAuthenticationResponse({
          response,
          // A challenge WE issued to this account for this check, unexpired, used up here.
          expectedChallenge: async (challenge) =>
            (await store.takeChallenge(challenge, "authentication", user.id, now())) !== null,
          expectedOrigin: config.origin,
          expectedRPID: config.rpId,
          credential: { id: stored.credentialId, publicKey: new Uint8Array(stored.publicKey), counter: stored.counter },
          requireUserVerification: true,
        });
        if (!verification.verified) return false;
        await store.updateCounter(stored.credentialId, verification.authenticationInfo.newCounter);
        return true;
      } catch {
        return false;
      }
    },

    /**
     * Sign up with a passkey alone, no email. Step 1. Nobody is logged in and no account
     * exists yet: we only reserve the id the account will get, and create it in step 3.
     */
    async signupOptions(): Promise<PublicKeyCredentialCreationOptionsJSON> {
      const pendingUserId = randomUUID();
      const options = await generateRegistrationOptions({
        rpName: config.rpName,
        rpID: config.rpId,
        userName: `ktrg-${pendingUserId.slice(0, 8)}`,
        userID: new TextEncoder().encode(pendingUserId),
        attestationType: "none",
        ...registrationSettings(),
      });
      await newChallenge({ challenge: options.challenge, type: "registration", userId: null, pendingUserId });
      return options;
    },

    /** Sign up with a passkey, step 3: a good passkey creates the account (participant) with the name and origin given. */
    async verifySignup(
      response: RegistrationResponseJSON,
      label: string | null,
      profile: NewAccountProfile,
    ): Promise<LoginResult> {
      const taken = { pendingUserId: null as string | null };
      const credential = await verifyNewCredential(response, async (challenge) => {
        const row = await store.takeChallenge(challenge, "registration", null, now());
        taken.pendingUserId = row?.pendingUserId ?? null;
        return taken.pendingUserId !== null;
      });
      if (!credential || !taken.pendingUserId) return { ok: false };

      const created = await store.createUserWithPasskey({ userId: taken.pendingUserId, ...credential, label, profile });
      if (!created) return { ok: false };

      return { ok: true, user: { id: taken.pendingUserId, email: null, role: "participant", locale: profile.locale } };
    },

    /**
     * Login step 1. No email is asked for: with no allowCredentials the phone shows
     * whichever passkeys it holds for this site and the user picks one.
     */
    async loginOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
      const options = await generateAuthenticationOptions({ rpID: config.rpId, userVerification: "required" });
      await newChallenge({ challenge: options.challenge, type: "authentication", userId: null, pendingUserId: null });
      return options;
    },

    /** Login step 3: check the phone's signature against the public key we stored. */
    async verifyLogin(response: AuthenticationResponseJSON): Promise<LoginResult> {
      const stored = await store.findCredential(response.id);
      if (!stored) return { ok: false };

      // The phone also returns the id we gave it at registration; it must be this passkey's owner.
      const handle = response.response.userHandle;
      if (handle !== undefined && Buffer.from(handle, "base64url").toString() !== stored.userId) {
        return { ok: false };
      }

      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response,
          // A challenge WE issued for a login, unexpired, used up here.
          expectedChallenge: async (challenge) =>
            (await store.takeChallenge(challenge, "authentication", null, now())) !== null,
          expectedOrigin: config.origin,
          expectedRPID: config.rpId,
          credential: { id: stored.credentialId, publicKey: new Uint8Array(stored.publicKey), counter: stored.counter },
          requireUserVerification: true,
        });
      } catch {
        return { ok: false };
      }
      if (!verification.verified) return { ok: false };

      const user = await store.userById(stored.userId);
      if (!user) return { ok: false };

      await store.updateCounter(stored.credentialId, verification.authenticationInfo.newCounter);
      return { ok: true, user };
    },
  };

  /** Run the library's registration check; returns the new credential or null. */
  async function verifyNewCredential(
    response: RegistrationResponseJSON,
    challengeIsOurs: (challenge: string) => Promise<boolean>,
  ): Promise<Omit<NewPasskey, "userId" | "label"> | null> {
    try {
      const verification = await verifyRegistrationResponse({
        response,
        // The challenge must be one WE issued for this ceremony, unexpired, and it is used up here.
        expectedChallenge: challengeIsOurs,
        expectedOrigin: config.origin,
        expectedRPID: config.rpId,
        requireUserVerification: true,
      });
      if (!verification.verified) return null;
      const { credential } = verification.registrationInfo;
      return { credentialId: credential.id, publicKey: credential.publicKey, counter: credential.counter };
    } catch {
      return null;
    }
  }
}

export type PasskeyService = ReturnType<typeof createPasskeyService>;
