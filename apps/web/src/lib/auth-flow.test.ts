import { describe, expect, test } from "bun:test";
import { ageRanges, failureFromApi, genders, hasName, origins, safeNextPath, formatPublicId } from "./auth-flow";

describe("failureFromApi", () => {
  test("known API codes pass through", () => {
    expect(failureFromApi(401, { ok: false, error: "invalid_code" })).toBe("invalid_code");
    expect(failureFromApi(401, { ok: false, error: "login_failed" })).toBe("login_failed");
    expect(failureFromApi(400, { ok: false, error: "invalid_display_name" })).toBe("invalid_display_name");
    expect(failureFromApi(400, { ok: false, error: "registration_failed" })).toBe("registration_failed");
  });

  test("429 is rate-limited, whatever the body says", () => {
    expect(failureFromApi(429, { ok: false, error: "rate_limited" })).toBe("rate_limited");
    expect(failureFromApi(429, undefined)).toBe("rate_limited");
  });

  test("with no usable code the status decides; anything else is a plain failure", () => {
    expect(failureFromApi(500, { ok: false, error: "internal_error" })).toBe("internal_error");
    expect(failureFromApi(500, null)).toBe("internal_error");
    expect(failureFromApi(422, "text")).toBe("failed");
  });
});

describe("safeNextPath", () => {
  test("keeps a path on this site", () => {
    expect(safeNextPath("/routes/2", "/")).toBe("/routes/2");
    expect(safeNextPath("/stamps?x=1", "/")).toBe("/stamps?x=1");
  });

  test("anything that could leave the site falls back", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined]) {
      expect(safeNextPath(bad, "/")).toBe("/");
    }
  });
});

describe("sign-up choices", () => {
  test("a name needs a visible character", () => {
    expect(hasName("Hana")).toBe(true);
    expect(hasName("  山田 ")).toBe(true);
    expect(hasName("   ")).toBe(false);
    expect(hasName("")).toBe(false);
  });

  test("the origin keys are the API's", () => {
    expect(origins).toEqual(["osaka", "wakayama", "nara", "other_japan", "overseas"]);
  });
});

describe("about-you choices", () => {
  test("the age bands and gender answers are the API's, and 'unspecified' is an answer", () => {
    expect(ageRanges).toEqual(["under20", "20s", "30s", "40s", "50s", "60s", "70plus"]);
    expect(genders).toEqual(["female", "male", "other", "unspecified"]);
  });

  test("the public ID is shown as two groups of four digits", () => {
    expect(formatPublicId("00048271")).toBe("0004-8271");
    expect(formatPublicId("abc")).toBe("abc");
  });
});
