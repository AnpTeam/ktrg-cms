import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** Counted in characters. The upper limit keeps a huge input from costing the hash more than a login is worth. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

// OWASP's scrypt setting: 2^17 with r=8 and p=1, about 128 MB per hash. Each hash stores its own cost, so it can be raised later.
export const SCRYPT_COST = 2 ** 17;
const BLOCK_SIZE = 8;
const KEY_LENGTH = 32;

const derive = (password: string, salt: Buffer, cost: number) =>
  new Promise<Buffer>((resolve, reject) => {
    // Japanese keyboards can type full-width characters: the same password should match either way.
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { N: cost, r: BLOCK_SIZE, p: 1, maxmem: 256 * cost * BLOCK_SIZE }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });

/** A salted scrypt hash as `scrypt$cost$salt$key`. Only this is stored. */
export async function hashPassword(password: string, cost = SCRYPT_COST): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, cost);
  return `scrypt$${cost}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, cost, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !cost || !salt || !key) return false;
  return timingSafeEqual(await derive(password, Buffer.from(salt, "base64"), Number(cost)), Buffer.from(key, "base64"));
}

// shortcut: a short hand-picked list, swap for a real leaked-password list if accounts get attacked.
const COMMON = new Set(["password", "password1", "12345678", "123456789", "1234567890", "87654321", "qwertyui", "qwerty123", "abcd1234", "iloveyou", "katsuragi"]);

/** Why this password is refused, or null. Length and common words only: rules about symbols make people write passwords down. */
export function passwordProblem(password: string, email: string | null): "too_short" | "too_common" | null {
  const plain = password.normalize("NFKC");
  if ([...plain].length < PASSWORD_MIN) return "too_short";
  const lower = plain.toLowerCase();
  const address = email?.toLowerCase();
  if (COMMON.has(lower) || new Set(lower).size === 1 || lower === address || lower === address?.split("@")[0]) return "too_common";
  return null;
}

/** The link in the "your password changed" email: 32 random bytes, of which only the hash is stored. */
export const generateUndoToken = () => randomBytes(32).toString("base64url");
export const hashUndoToken = (token: string) => createHash("sha256").update(token).digest("hex");
