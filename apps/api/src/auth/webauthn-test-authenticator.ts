import { createHash, generateKeyPairSync, randomBytes, type KeyObject } from "node:crypto";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

// Test support: a tiny software "phone" that makes real WebAuthn registrations
// (ES256, "none" attestation) so the real verifier can be exercised without a device.

const head = (major: number, n: number) =>
  n < 24
    ? Buffer.from([(major << 5) | n])
    : n < 256
      ? Buffer.from([(major << 5) | 24, n])
      : Buffer.from([(major << 5) | 25, n >> 8, n & 255]);
const uint = (n: number) => head(0, n);
const nint = (n: number) => head(1, -1 - n);
const bytes = (b: Uint8Array) => Buffer.concat([head(2, b.length), b]);
const text = (s: string) => Buffer.concat([head(3, Buffer.byteLength(s)), Buffer.from(s)]);
const map = (...kv: Buffer[]) => Buffer.concat([head(5, kv.length / 2), ...kv]);
const u32 = (n: number) => Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const u16 = (n: number) => Buffer.from([(n >> 8) & 255, n & 255]);
const b64url = (b: Uint8Array | string) => Buffer.from(b).toString("base64url");

export interface RegisterOverrides {
  /** Origin the browser claims to be on. */
  origin?: string;
  /** RP ID the authenticator signs for. */
  rpId?: string;
  /** Challenge to echo back instead of the real one. */
  challenge?: string;
  /** Set false to simulate a device that did not check Face ID / fingerprint. */
  userVerified?: boolean;
}

export class TestAuthenticator {
  readonly credentialId = randomBytes(32);
  readonly privateKey: KeyObject;
  private readonly x: Buffer;
  private readonly y: Buffer;
  counter = 0;

  constructor(private readonly defaults: { origin: string; rpId: string }) {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    this.privateKey = privateKey;
    const jwk = publicKey.export({ format: "jwk" });
    this.x = Buffer.from(jwk.x!, "base64url");
    this.y = Buffer.from(jwk.y!, "base64url");
  }

  get id(): string {
    return b64url(this.credentialId);
  }

  /** What navigator.credentials.create() returns, as JSON, for the given options. */
  register(options: { challenge: string }, o: RegisterOverrides = {}): RegistrationResponseJSON {
    const rpId = o.rpId ?? this.defaults.rpId;
    const flags = 0x01 /* user present */ | (o.userVerified === false ? 0 : 0x04) | 0x40; /* has credential data */

    // COSE public key: kty=EC2, alg=ES256, crv=P-256, x, y.
    const cose = map(uint(1), uint(2), uint(3), nint(-7), nint(-1), uint(1), nint(-2), bytes(this.x), nint(-3), bytes(this.y));
    const authData = Buffer.concat([
      createHash("sha256").update(rpId).digest(),
      Buffer.from([flags]),
      u32(this.counter),
      Buffer.alloc(16), // AAGUID
      u16(this.credentialId.length),
      this.credentialId,
      cose,
    ]);
    const attestationObject = map(text("fmt"), text("none"), text("attStmt"), map(), text("authData"), bytes(authData));
    const clientDataJSON = JSON.stringify({
      type: "webauthn.create",
      challenge: o.challenge ?? options.challenge,
      origin: o.origin ?? this.defaults.origin,
      crossOrigin: false,
    });

    return {
      id: this.id,
      rawId: this.id,
      type: "public-key",
      response: {
        clientDataJSON: b64url(clientDataJSON),
        attestationObject: b64url(attestationObject),
        transports: ["internal"],
      },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    };
  }
}
