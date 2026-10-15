import { describe, expect, test } from "bun:test";
import { generateOtpCode, hashOtpCode, normalizeEmail } from "./otp";

describe("generateOtpCode", () => {
  test("is always six digits, including leading zeros", () => {
    for (let i = 0; i < 2000; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  test("varies between calls", () => {
    const codes = new Set(Array.from({ length: 50 }, generateOtpCode));
    expect(codes.size).toBeGreaterThan(40);
  });
});

describe("hashOtpCode", () => {
  const secret = "s".repeat(32);

  test("is a deterministic 64-char hex digest", () => {
    const a = hashOtpCode(secret, "a@example.com", "123456");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOtpCode(secret, "a@example.com", "123456")).toBe(a);
  });

  test("ignores email case and padding", () => {
    expect(hashOtpCode(secret, "  A@Example.COM ", "123456")).toBe(
      hashOtpCode(secret, "a@example.com", "123456"),
    );
  });

  test("depends on the secret, the email and the code", () => {
    const base = hashOtpCode(secret, "a@example.com", "123456");
    expect(hashOtpCode("x".repeat(32), "a@example.com", "123456")).not.toBe(base);
    expect(hashOtpCode(secret, "b@example.com", "123456")).not.toBe(base);
    expect(hashOtpCode(secret, "a@example.com", "654321")).not.toBe(base);
  });

  test("never contains the plain code", () => {
    expect(hashOtpCode(secret, "a@example.com", "123456")).not.toContain("123456");
  });
});

test("normalizeEmail trims and lowercases", () => {
  expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
});
