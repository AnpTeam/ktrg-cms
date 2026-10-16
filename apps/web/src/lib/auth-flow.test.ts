import { describe, expect, test } from "bun:test";
import { failureFromApi, hasName, origins, safeNextPath } from "./auth-flow";

describe("failureFromApi", () => {
  test("known API codes pass through", () => {
    expect(failureFromApi(401, { ok: false, error: "invalid_code" })).toBe("invalid_code");
    expect(failureFromApi(401, { ok: false, error: "login_failed" })).toBe("login_failed");
    expect(failureFromApi(400, { ok: false, error: "invalid_display_name" })).toBe("invalid_display_name");
    expect(failureFromApi(400, { ok: false, error: "registration_failed" })).toBe("registration_failed");
  });

  test("429 is its own case, whatever the body says", () => {
    expect(failureFromApi(429, { ok: false, error: "too_many_requests" })).toBe("too_many_requests");
    expect(failureFromApi(429, undefined)).toBe("too_many_requests");
  });

  test("anything unknown is a plain failure", () => {
    expect(failureFromApi(500, { ok: false, error: "internal_error" })).toBe("failed");
    expect(failureFromApi(422, "text")).toBe("failed");
    expect(failureFromApi(500, null)).toBe("failed");
  });
});

describe("safeNextPath", () => {
  test("keeps a path on this site", () => {
    expect(safeNextPath("/ja/routes/2", "/ja")).toBe("/ja/routes/2");
    expect(safeNextPath("/en/stamps?x=1", "/en")).toBe("/en/stamps?x=1");
  });

  test("anything that could leave the site falls back", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined]) {
      expect(safeNextPath(bad, "/ja")).toBe("/ja");
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
