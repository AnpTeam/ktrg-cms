import { describe, expect, test } from "bun:test";
import {
  accountPrefs,
  syncDirection,
  defaultPrefs,
  effectivePrefs,
  parsePrefsCookie,
  prefsCookieString,
  sanitizePrefs,
  sizePercent,
  textSizes,
} from "./prefs";

describe("defaults", () => {
  test("the plain map, standard size, set-up not done", () => {
    expect(defaultPrefs).toEqual({ size: "standard", mergeStops: false, placesOnMap: false, setupDone: false, furigana: false, contrast: false, calm: false, updatedAt: 0 });
  });

  test("each size has a percentage, growing", () => {
    expect(textSizes.map((s) => sizePercent[s])).toEqual([100, 112.5, 125]);
  });
});

describe("sanitizePrefs", () => {
  test("a good value passes through", () => {
    const p = { size: "large", mergeStops: true, placesOnMap: true, setupDone: true, furigana: false, contrast: false, calm: false, updatedAt: 1760000000000 } as const;
    expect(sanitizePrefs(p)).toEqual(p);
  });

  test("each field falls back on its own", () => {
    expect(sanitizePrefs({ size: "huge", mergeStops: "yes", placesOnMap: true })).toEqual({
      size: "standard",
      mergeStops: false,
      placesOnMap: true,
      setupDone: false,
      furigana: false,
      contrast: false,
      calm: false,
      updatedAt: 0,
    });
    expect(sanitizePrefs(null)).toEqual(defaultPrefs);
    expect(sanitizePrefs("x")).toEqual(defaultPrefs);
  });

  test("extra fields are dropped", () => {
    expect(Object.keys(sanitizePrefs({ ...defaultPrefs, role: "admin" })).sort()).toEqual(["calm", "contrast", "furigana", "mergeStops", "placesOnMap", "setupDone", "size", "updatedAt"]);
  });
});

describe("the device cookie", () => {
  test("what is written can be read back", () => {
    const p = { size: "xlarge", mergeStops: true, placesOnMap: false, setupDone: true, furigana: false, contrast: false, calm: false, updatedAt: 1760000000000 } as const;
    const cookie = prefsCookieString(p, false);
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).not.toContain("Secure");
    expect(prefsCookieString(p, true)).toContain("; Secure");
    expect(parsePrefsCookie(cookie.split(";")[0]!.slice("prefs=".length))).toEqual(p);
  });

  test("missing or broken gives null, not the defaults (so the account can still apply)", () => {
    expect(parsePrefsCookie(undefined)).toBeNull();
    expect(parsePrefsCookie("")).toBeNull();
    expect(parsePrefsCookie("not json")).toBeNull();
    expect(parsePrefsCookie("%E0%A4%A")).toBeNull();
    expect(parsePrefsCookie(encodeURIComponent("123"))).toBeNull();
  });
});

describe("which choices apply", () => {
  const older = { ...defaultPrefs, size: "xlarge", updatedAt: 1000 } as const;
  const newer = { ...defaultPrefs, size: "large", updatedAt: 2000 } as const;

  test("the newer copy wins, whichever side it is on", () => {
    expect(effectivePrefs(older, newer)).toEqual(newer); // the phone's change that never reached the account
    expect(effectivePrefs(newer, older)).toEqual(newer); // a new phone with an old cookie
  });

  test("a tie goes to the account; a copy with no time is the oldest", () => {
    const same = { ...older, size: "large" } as const;
    expect(effectivePrefs(older, same)).toEqual(older);
    expect(effectivePrefs({ ...older, updatedAt: 0 }, { ...newer, updatedAt: 1 })).toEqual({ ...newer, updatedAt: 1 });
  });

  test("with one copy, that one; with none, the defaults", () => {
    expect(effectivePrefs(null, newer)).toEqual(newer);
    expect(effectivePrefs(older, null)).toEqual(older);
    expect(effectivePrefs(null, null)).toEqual(defaultPrefs);
  });

  test("the account's value from the API is cleaned, and nothing means null", () => {
    expect(accountPrefs(null)).toBeNull();
    expect(accountPrefs(undefined)).toBeNull();
    expect(accountPrefs({ size: "large" })).toEqual({ ...defaultPrefs, size: "large" });
  });
});

describe("keeping the two copies equal", () => {
  const older = { ...defaultPrefs, updatedAt: 1000 };
  const newer = { ...defaultPrefs, size: "large", updatedAt: 2000 } as const;

  test("the phone's newer copy is pushed to the account; the account's newer copy is pulled to the phone", () => {
    expect(syncDirection(older, newer)).toBe("push");
    expect(syncDirection(newer, older)).toBe("pull");
  });

  test("a missing copy is filled from the other", () => {
    expect(syncDirection(null, newer)).toBe("push");
    expect(syncDirection(newer, null)).toBe("pull");
  });

  test("equal times, or nothing at all, need nothing", () => {
    expect(syncDirection(newer, { ...newer })).toBe("none");
    expect(syncDirection(null, null)).toBe("none");
  });
});
