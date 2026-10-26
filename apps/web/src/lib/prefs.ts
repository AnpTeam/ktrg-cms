// The visitor's own accessibility and map choices: how big the text and the buttons are, whether
// crowded map stops are merged, whether nearby places show on the map from the start. They are kept
// in a cookie on the device (works for everyone, signed in or not) and, for a signed-in visitor,
// also on the account (PATCH /me, `preferences`) so they follow the person to a new phone.
// Pure functions, unit-tested; the same shape as apps/api/src/me/preferences.ts.

export const textSizes = ["standard", "large", "xlarge"] as const;
export type TextSize = (typeof textSizes)[number];

export interface Prefs {
  /** Text and components together (everything is in rem): 100%, 112.5% or 125% of the base size. */
  size: TextSize;
  /** Merge stops that sit close together on the map into one numbered group. */
  mergeStops: boolean;
  /** Show the nearby places (toilets, shops ...) on the map from the start. */
  placesOnMap: boolean;
  /** The first-time set-up was done or skipped, so it is not offered again. */
  setupDone: boolean;
  /** Furigana over every kanji on the page (read by the server that adds them, see components/FuriganaLayer.tsx). */
  furigana: boolean;
  /** Stronger contrast: black on white and thicker lines. */
  contrast: boolean;
  /** Calm: no animation or movement. */
  calm: boolean;
  /** When this choice was made (milliseconds since 1970, by the phone's clock); the newer copy wins. 0 = unknown. */
  updatedAt: number;
}

/** The plain map and standard size: the simplest choices. */
export const defaultPrefs: Prefs = { size: "standard", mergeStops: false, placesOnMap: false, setupDone: false, furigana: false, contrast: false, calm: false, updatedAt: 0 };

export const prefsCookie = "prefs";

/** The root font size each step stands for (also written in globals.css as html[data-size]). */
export const sizePercent: Record<TextSize, number> = { standard: 100, large: 112.5, xlarge: 125 };

const isSize = (v: unknown): v is TextSize => typeof v === "string" && (textSizes as readonly string[]).includes(v);

/** Anything unknown falls back to the default, field by field. */
export function sanitizePrefs(value: unknown): Prefs {
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  return {
    size: isSize(v.size) ? v.size : defaultPrefs.size,
    mergeStops: typeof v.mergeStops === "boolean" ? v.mergeStops : defaultPrefs.mergeStops,
    placesOnMap: typeof v.placesOnMap === "boolean" ? v.placesOnMap : defaultPrefs.placesOnMap,
    setupDone: typeof v.setupDone === "boolean" ? v.setupDone : defaultPrefs.setupDone,
    furigana: v.furigana === true,
    contrast: v.contrast === true,
    calm: v.calm === true,
    updatedAt: Number.isSafeInteger(v.updatedAt) && (v.updatedAt as number) >= 0 ? (v.updatedAt as number) : 0,
  };
}

/** The choices from the cookie's value (what the server reads); null when there is none or it is broken. */
export function parsePrefsCookie(raw: string | null | undefined): Prefs | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    return typeof parsed === "object" && parsed !== null ? sanitizePrefs(parsed) : null;
  } catch {
    return null;
  }
}

/** The account's choices as the API sends them; null when it sent none. */
export function accountPrefs(value: unknown): Prefs | null {
  return typeof value === "object" && value !== null ? sanitizePrefs(value) : null;
}

/**
 * Which choices apply: the NEWER of the account's copy and this phone's copy (by `updatedAt`), so a
 * new phone gets the account's choices, and a change that could not reach the account (no signal) is
 * not undone by the older copy there. A tie goes to the account. With only one copy, that one;
 * with none, the defaults.
 */
export function effectivePrefs(account: Prefs | null, device: Prefs | null): Prefs {
  if (account && device) return device.updatedAt > account.updatedAt ? device : account;
  return account ?? device ?? defaultPrefs;
}

/**
 * What a signed-in visitor's phone should do to keep the two copies equal:
 *  "push"  the phone's copy is newer (or the account has none): send it to the account;
 *  "pull"  the account's copy is newer (or the phone has none): write it to the phone's cookie;
 *  "none"  they already agree (same time), or neither exists.
 */
export function syncDirection(account: Prefs | null, device: Prefs | null): "push" | "pull" | "none" {
  if (device && (!account || device.updatedAt > account.updatedAt)) return "push";
  if (account && (!device || account.updatedAt > device.updatedAt)) return "pull";
  return "none";
}

export function prefsCookieString(prefs: Prefs, secure: boolean): string {
  return `${prefsCookie}=${encodeURIComponent(JSON.stringify(sanitizePrefs(prefs)))}; Path=/; SameSite=Lax; Max-Age=31536000${secure ? "; Secure" : ""}`;
}
