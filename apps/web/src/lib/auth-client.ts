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

/**
 * A name for a new passkey from the browser it was made in, like "iPhone · Safari". The provider (iCloud Keychain,
 * Google Password Manager) is not visible to a web page, so this says where it was made, not where it is kept.
 */
export function passkeyLabel(userAgent: string, touchPoints = 0): string {
  const ua = userAgent;
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux|X11/.test(ua)
              ? "Linux"
              : "";
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /FxiOS|Firefox/.test(ua)
        ? "Firefox"
        : /CriOS|Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "";
  return [device, browser].filter(Boolean).join(" · ");
}

const ownLabel = () => (typeof navigator === "undefined" ? undefined : passkeyLabel(navigator.userAgent, navigator.maxTouchPoints) || undefined);

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
      label: ownLabel(),
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

/** Signed in without an email: mail a code to the address to add (needs the "confirm it is you" step first). */
export async function requestAddEmail(email: string): Promise<AuthResult> {
  try {
    const res = await api.auth.email.request.post({ email });
    return res.error ? fail(apiFailure(res.error)) : done;
  } catch {
    return fail("network");
  }
}

/** Check the code from the new mailbox; on success the account has that email. */
export async function verifyAddEmail(email: string, code: string): Promise<AuthResult> {
  try {
    const res = await api.auth.email.verify.post({ email, code });
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

/** One of the account's passkeys, as the settings screen shows it: never any key material. */
export interface PasskeyItem {
  id: string;
  label: string | null;
  /** ISO timestamp. */
  createdAt: string;
}

export async function listPasskeys(): Promise<{ ok: true; passkeys: PasskeyItem[] } | { ok: false; code: AuthFailure }> {
  try {
    const res = await api.auth.passkeys.get();
    if (res.error || !res.data) return { ok: false, code: apiFailure(res.error) };
    return { ok: true, passkeys: res.data.passkeys.map((p) => ({ id: p.id, label: p.label, createdAt: new Date(p.createdAt).toISOString() })) };
  } catch {
    return { ok: false, code: "network" };
  }
}

/** Add a passkey for this phone to the signed-in account: the face or fingerprint prompt is the confirmation. */
export async function addPasskey(): Promise<AuthResult> {
  if (!passkeysSupported()) return fail("unsupported");
  try {
    const opts = await api.auth.passkeys.register.options.post();
    if (opts.error || !opts.data) return fail(apiFailure(opts.error));
    if (!opts.data.ok) return fail("too_many_passkeys");

    let attestation;
    try {
      attestation = await startRegistration({ optionsJSON: opts.data.options as unknown as PublicKeyCredentialCreationOptionsJSON });
    } catch (err) {
      return fail(ceremonyFailure(err, "registration_failed"));
    }

    const verified = await api.auth.passkeys.register.verify.post({ response: withoutNulls(attestation) as never, label: ownLabel() });
    return verified.error ? fail(apiFailure(verified.error)) : done;
  } catch {
    return fail("network");
  }
}

/** Remove one of the account's own passkeys (the API refuses to remove the last way to log in). */
export async function removePasskey(id: string): Promise<AuthResult> {
  try {
    const res = await api.auth.passkeys({ id }).delete();
    return res.error ? fail(apiFailure(res.error)) : done;
  } catch {
    return fail("network");
  }
}

// ---- Fresh login: "confirm it is you again" before a sensitive action -----------------------------------------

/** Confirm with the phone's face, fingerprint or lock code (a passkey the account already holds). */
export async function reauthWithPasskey(): Promise<AuthResult> {
  if (!passkeysSupported()) return fail("unsupported");
  try {
    const opts = await api.auth.passkeys.reauth.options.post();
    if (opts.error || !opts.data) return fail(apiFailure(opts.error));
    if (!opts.data.ok) return fail("no_passkey");

    let assertion;
    try {
      assertion = await startAuthentication({ optionsJSON: opts.data.options as unknown as PublicKeyCredentialRequestOptionsJSON });
    } catch (err) {
      return fail(ceremonyFailure(err, "reauth_failed"));
    }

    const verified = await api.auth.passkeys.reauth.verify.post({ response: withoutNulls(assertion) as never });
    return verified.error ? fail(apiFailure(verified.error)) : done;
  } catch {
    return fail("network");
  }
}

/** Email a 6-digit number to the signed-in account (for an account with no passkey, or none on this phone). */
export async function requestReauthCode(): Promise<AuthResult> {
  try {
    const res = await api.auth.reauth.request.post();
    return res.error ? fail(apiFailure(res.error)) : done;
  } catch {
    return fail("network");
  }
}

export async function verifyReauthCode(code: string): Promise<AuthResult> {
  try {
    const res = await api.auth.reauth.verify.post({ code });
    return res.error ? fail(apiFailure(res.error)) : done;
  } catch {
    return fail("network");
  }
}

/** Ask for the account to be deleted after the grace period (needs a fresh login). */
export async function requestAccountDeletion(): Promise<AuthResult> {
  try {
    const res = await api.me.delete();
    return res.error ? fail(apiFailure(res.error)) : done;
  } catch {
    return fail("network");
  }
}
