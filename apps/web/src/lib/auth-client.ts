import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { api } from "./api";
import { failureFromApi, type AuthFailure, type Origin } from "./auth-flow";

// The browser side of sign-in: each call returns `{ ok: true }` or `{ ok: false, code }`, never
// throws. The session itself is the HttpOnly cookie the API sets; nothing is kept in
// localStorage or sessionStorage (CLAUDE.md hard rule 3).

export type AuthResult = { ok: true } | { ok: false; code: AuthFailure };
export interface SignupProfile {
  displayName: string;
  origin: Origin | null;
  locale: "ja" | "en";
}

const fail = (code: AuthFailure): AuthResult => ({ ok: false, code });
const done: AuthResult = { ok: true };

/** The API answered with an error: map its status and body. */
function apiFailure(error: { status: unknown; value: unknown } | null): AuthFailure {
  const status = typeof error?.status === "number" ? error.status : 0;
  return status === 0 ? "network" : failureFromApi(status, error?.value);
}

/** What the phone's passkey prompt can throw: cancelling it or letting it time out is NotAllowedError. */
function ceremonyFailure(err: unknown, fallback: AuthFailure): AuthFailure {
  const name = (err as { name?: string } | null)?.name;
  return name === "NotAllowedError" || name === "AbortError" ? "cancelled" : fallback;
}

/** The browser's JSON has `null` for missing fields; the API's strict body schema wants them absent. */
const withoutNulls = <T>(value: T): T => JSON.parse(JSON.stringify(value, (_k, v) => (v === null ? undefined : v))) as T;

export const passkeysSupported = () => typeof window !== "undefined" && browserSupportsWebAuthn();

const profileBody = (profile: SignupProfile) => ({
  displayName: profile.displayName,
  origin: profile.origin ?? undefined,
  locale: profile.locale,
});

/** Create an account with a passkey alone: needs a name; the face or fingerprint scan is the sign-up. */
export async function signUpWithPasskey(profile: SignupProfile): Promise<AuthResult> {
  if (!passkeysSupported()) return fail("unsupported");
  try {
    const opts = await api.auth.passkeys.signup.options.post();
    if (opts.error || !opts.data) return fail(apiFailure(opts.error));

    let attestation;
    try {
      attestation = await startRegistration({ optionsJSON: opts.data.options as unknown as PublicKeyCredentialCreationOptionsJSON });
    } catch (err) {
      return fail(ceremonyFailure(err, "registration_failed"));
    }

    const verified = await api.auth.passkeys.signup.verify.post({
      response: withoutNulls(attestation) as never,
      profile: profileBody(profile),
    });
    return verified.error ? fail(apiFailure(verified.error)) : done;
  } catch {
    return fail("network");
  }
}

/** Log in with a passkey the phone already holds for this site: no email, no name. */
export async function logInWithPasskey(): Promise<AuthResult> {
  if (!passkeysSupported()) return fail("unsupported");
  try {
    const opts = await api.auth.passkeys.login.options.post();
    if (opts.error || !opts.data) return fail(apiFailure(opts.error));

    let assertion;
    try {
      assertion = await startAuthentication({ optionsJSON: opts.data.options as unknown as PublicKeyCredentialRequestOptionsJSON });
    } catch (err) {
      return fail(ceremonyFailure(err, "login_failed"));
    }

    const verified = await api.auth.passkeys.login.verify.post({ response: withoutNulls(assertion) as never });
    return verified.error ? fail(apiFailure(verified.error)) : done;
  } catch {
    return fail("network");
  }
}

/** Email a 6-digit code. The API answers the same whether or not the address has an account. */
export async function requestEmailCode(email: string, locale: "ja" | "en"): Promise<AuthResult> {
  try {
    const res = await api.auth.otp.request.post({ email, locale });
    return res.error ? fail(apiFailure(res.error)) : done;
  } catch {
    return fail("network");
  }
}

/** Check the code. `profile` is used only when this creates the account (register); login omits it. */
export async function verifyEmailCode(email: string, code: string, profile?: SignupProfile): Promise<AuthResult> {
  try {
    const res = await api.auth.otp.verify.post({ email, code, profile: profile ? profileBody(profile) : undefined });
    return res.error ? fail(apiFailure(res.error)) : done;
  } catch {
    return fail("network");
  }
}

export async function logOut(): Promise<AuthResult> {
  try {
    const res = await api.auth.logout.post();
    return res.error ? fail(apiFailure(res.error)) : done;
  } catch {
    return fail("network");
  }
}
