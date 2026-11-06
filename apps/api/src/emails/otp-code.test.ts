import { describe, expect, test } from "bun:test";
import { buildOtpEmail } from "./otp-code";

const base = { to: "a@example.com", code: "042137", ttlMinutes: 10 };

describe("buildOtpEmail", () => {
  test("English", () => {
    const m = buildOtpEmail({ ...base, locale: "en" });
    expect(m.to).toBe("a@example.com");
    expect(m.subject).toBe("[Katsuragi Shugen] Your verification code");
    expect(m.text).toContain("Enter this code to sign in to Katsuragi Shugen.");
    expect(m.text).toContain("042137");
    expect(m.text).toContain("valid for 10 minutes");
    expect(m.html).toContain('<html lang="en">');
    expect(m.html).toContain("042137");
  });

  test("Japanese", () => {
    const m = buildOtpEmail({ ...base, locale: "ja" });
    expect(m.subject).toBe("【葛城修験】確認番号");
    expect(m.text).toContain("042137");
    expect(m.text).toContain("10分間有効");
    expect(m.text).toContain("心当たりがない場合");
    expect(m.html).toContain('<html lang="ja">');
  });

  test("the code is not in the subject", () => {
    for (const locale of ["ja", "en"] as const) {
      expect(buildOtpEmail({ ...base, locale }).subject).not.toContain("042137");
    }
  });

  test("carries no link", () => {
    for (const locale of ["ja", "en"] as const) {
      const m = buildOtpEmail({ ...base, locale });
      expect(m.text).not.toMatch(/https?:\/\//);
      expect(m.html).not.toMatch(/href=/);
    }
  });
});
