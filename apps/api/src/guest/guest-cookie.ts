import { createHmac, timingSafeEqual } from "node:crypto";

// The stamps of a visitor with no account, kept in a cookie the server signs. The browser holds them and cannot change
// them (the signature would not match), and every page the server draws can read them, so a guest sees their progress
// everywhere an account would. Each stamp is 20 bytes: the place's id (16) and the time (4, seconds; the top bit says the
// reading was a rough one, as for an account's flagged stamps).

export interface GuestStamp {
  spotId: string;
  /** Seconds since 1970. */
  at: number;
  flagged: boolean;
}

/** About 150 stamps fill a 4 KB cookie; this stays well under. A guest past it is asked to sign up. */
export const GUEST_MAX = 120;

const FLAG = 0x80000000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TAG_BYTES = 16;

const sign = (data: Buffer, secret: string) => createHmac("sha256", secret).update("guest-stamps:").update(data).digest().subarray(0, TAG_BYTES);

export function encodeGuest(stamps: readonly GuestStamp[], secret: string): string {
  const data = Buffer.alloc(stamps.length * 20);
  stamps.forEach((s, i) => {
    Buffer.from(s.spotId.replaceAll("-", ""), "hex").copy(data, i * 20);
    data.writeUInt32BE(((s.at >>> 0) & ~FLAG | (s.flagged ? FLAG : 0)) >>> 0, i * 20 + 16);
  });
  return `${data.toString("base64url")}.${sign(data, secret).toString("base64url")}`;
}

/** The stamps in the cookie; none when it is missing, damaged or not signed by us. */
export function decodeGuest(value: string | null | undefined, secret: string): GuestStamp[] {
  const [body, tag, ...rest] = (value ?? "").split(".");
  if (!body || !tag || rest.length > 0) return [];
  const data = Buffer.from(body, "base64url");
  const given = Buffer.from(tag, "base64url");
  const expected = sign(data, secret);
  if (data.length % 20 !== 0 || data.length / 20 > GUEST_MAX || given.length !== expected.length || !timingSafeEqual(given, expected)) return [];
  const out: GuestStamp[] = [];
  for (let i = 0; i < data.length; i += 20) {
    const hex = data.subarray(i, i + 16).toString("hex");
    const spotId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    if (!UUID.test(spotId)) continue;
    const word = data.readUInt32BE(i + 16);
    out.push({ spotId, at: word & ~FLAG, flagged: (word & FLAG) !== 0 });
  }
  return out;
}
