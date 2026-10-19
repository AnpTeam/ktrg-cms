import { describe, expect, test } from "bun:test";
import { errorKeyFromApi, isServerCode } from "./api-error";

describe("errorKeyFromApi", () => {
  test("a known code in the body wins over the status", () => {
    expect(errorKeyFromApi(401, { ok: false, error: "invalid_code" })).toBe("invalid_code");
    expect(errorKeyFromApi(403, { ok: false, error: "reauth_required" })).toBe("reauth_required");
    expect(errorKeyFromApi(409, { ok: false, error: "last_login_method" })).toBe("last_login_method");
    expect(errorKeyFromApi(429, { ok: false, error: "rate_limited" })).toBe("rate_limited");
  });

  test("without a usable code, the status decides", () => {
    expect(errorKeyFromApi(429, undefined)).toBe("rate_limited");
    expect(errorKeyFromApi(401, null)).toBe("unauthenticated");
    expect(errorKeyFromApi(403, "text")).toBe("forbidden");
    expect(errorKeyFromApi(404, {})).toBe("not_found");
    expect(errorKeyFromApi(500, undefined)).toBe("internal_error");
    expect(errorKeyFromApi(502, undefined)).toBe("internal_error");
  });

  test("an unknown code or status is a plain failure, never a crash", () => {
    expect(errorKeyFromApi(400, { ok: false, error: "something_new" })).toBe("failed");
    expect(errorKeyFromApi(400, { error: 42 })).toBe("failed");
    expect(errorKeyFromApi(418, undefined)).toBe("failed");
  });

  test("a prototype-chain name is not a code", () => {
    expect(isServerCode("constructor")).toBe(false);
    expect(isServerCode("__proto__")).toBe(false);
    expect(errorKeyFromApi(400, { error: "toString" })).toBe("failed");
  });
});
