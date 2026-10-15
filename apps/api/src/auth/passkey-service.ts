import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type PublicKeyCredentialCreationOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { AuthUser } from "./otp-service";

/** A passkey ceremony must finish within this long. */
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
/** Most passkeys one account may hold. */
export const MAX_PASSKEYS_PER_USER = 10;

export type ChallengeType = "registration" | "authentication";

/** Storage the passkey service needs; the Drizzle version is in passkey-store.ts. */
export interface PasskeyStore {
  /** Credential ids the user already has (so the same device is not added twice). */
  credentialIds(userId: string): Promise<string[]>;
  saveChallenge(row: {
    challenge: string;
    type: ChallengeType;
    userId: string | null;
    expiresAt: Date;
  }): Promise<void>;
  /**
   * Atomically take (delete) an unexpired challenge of this type that belongs to
   * this user. Returns false if it is unknown, expired, someone else's or already used.
   */
  takeChallenge(challenge: string, type: ChallengeType, userId: string | null, now: Date): Promise<boolean>;
  /** Forget challenges that expired before this time. */
  pruneChallenges(before: Date): Promise<void>;
  /** Returns false if the credential id is already registered. */
  insertPasskey(row: {
    userId: string;
    credentialId: string;
    publicKey: Uint8Array;
    counter: number;
    label: string | null;
  }): Promise<boolean>;
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
  | { ok: true; passkey: { credentialId: string; label: string | null } }
  | { ok: false; reason: "too_many" | "failed" };

export function createPasskeyService({
  store,
  config,
  now = () => new Date(),
}: {
  store: PasskeyStore;
  config: PasskeyConfig;
  now?: () => Date;
}) {
  return {
    /** Step 1: settings for the phone, plus a one-time challenge we remember. */
    async registrationOptions(
      user: AuthUser,
    ): Promise<{ ok: true; options: PublicKeyCredentialCreationOptionsJSON } | { ok: false; reason: "too_many" }> {
      const existing = await store.credentialIds(user.id);
      if (existing.length >= MAX_PASSKEYS_PER_USER) return { ok: false, reason: "too_many" };

      const options = await generateRegistrationOptions({
        rpName: config.rpName,
        rpID: config.rpId,
        userName: user.email,
        // An opaque id, never the email: the phone stores it with the passkey.
        userID: new TextEncoder().encode(user.id),
        attestationType: "none",
        excludeCredentials: existing.map((id) => ({ id })),
        // A discoverable passkey (so "log in with passkey" needs no email) and Face ID / fingerprint.
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
      });

      const at = now();
      await store.saveChallenge({
        challenge: options.challenge,
        type: "registration",
        userId: user.id,
        expiresAt: new Date(at.getTime() + CHALLENGE_TTL_MS),
      });
      // Tidy up challenges nobody finished.
      await store.pruneChallenges(at).catch(() => {});

      return { ok: true, options };
    },

    /** Step 3: check the phone's answer and keep the public key. */
    async verifyRegistration(
      user: AuthUser,
      response: RegistrationResponseJSON,
      label: string | null,
    ): Promise<RegisterResult> {
      if ((await store.credentialIds(user.id)).length >= MAX_PASSKEYS_PER_USER) {
        return { ok: false, reason: "too_many" };
      }

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response,
          // The challenge must be one WE issued to THIS user, unexpired, and it is used up here.
          expectedChallenge: (challenge) => store.takeChallenge(challenge, "registration", user.id, now()),
          expectedOrigin: config.origin,
          expectedRPID: config.rpId,
          requireUserVerification: true,
        });
      } catch {
        return { ok: false, reason: "failed" };
      }
      if (!verification.verified) return { ok: false, reason: "failed" };

      const { credential } = verification.registrationInfo;
      const saved = await store.insertPasskey({
        userId: user.id,
        credentialId: credential.id,
        publicKey: credential.publicKey,
        counter: credential.counter,
        label,
      });
      if (!saved) return { ok: false, reason: "failed" };

      return { ok: true, passkey: { credentialId: credential.id, label } };
    },
  };
}

export type PasskeyService = ReturnType<typeof createPasskeyService>;
