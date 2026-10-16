import { describe, expect, test } from "bun:test";
import {
  accountPrefs,
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
    expect(defaultPrefs).toEqual({ size: "standard", mergeStops: false, placesOnMap: false, setupDone: false });
  });

  test("each size has a percentage, growing", () => {
    expect(textSizes.map((s) => sizePercent[s])).toEqual([100, 112.5, 125]);
  });
});

describe("sanitizePrefs", () => {
  test("a good value passes through", () => {
    const p = { size: "large", mergeStops: true, placesOnMap: true, setupDone: true } as const;
    expect(sanitizePrefs(p)).toEqual(p);
  });

  test("each field falls back on its own", () => {
    expect(sanitizePrefs({ size: "huge", mergeStops: "yes", placesOnMap: true })).toEqual({
      size: "standard",
      mergeStops: false,
      placesOnMap: true,
      setupDone: false,
    });
    expect(sanitizePrefs(null)).toEqual(defaultPrefs);
    expect(sanitizePrefs("x")).toEqual(defaultPrefs);
  });

  test("extra fields are dropped", () => {
    expect(Object.keys(sanitizePrefs({ ...defaultPrefs, role: "admin" })).sort()).toEqual(["mergeStops", "placesOnMap", "setupDone", "size"]);
  });
});

describe("the device cookie", () => {
  test("what is written can be read back", () => {
    const p = { size: "xlarge", mergeStops: true, placesOnMap: false, setupDone: true } as const;
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
  const device = { ...defaultPrefs, size: "large" } as const;
  const account = { ...defaultPrefs, size: "xlarge" } as const;

  test("the account wins, then the device, then the defaults", () => {
    expect(effectivePrefs(account, device)).toEqual(account);
    expect(effectivePrefs(null, device)).toEqual(device);
    expect(effectivePrefs(null, null)).toEqual(defaultPrefs);
  });

  test("the account's value from the API is cleaned, and nothing means null", () => {
    expect(accountPrefs(null)).toBeNull();
    expect(accountPrefs(undefined)).toBeNull();
    expect(accountPrefs({ size: "large" })).toEqual({ ...defaultPrefs, size: "large" });
  });
});
