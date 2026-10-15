import { describe, expect, test } from "bun:test";
import { buildOtpEmail } from "./otp-code";
import { buildReauthEmail } from "./reauth-code";

const base = { to: "a@example.com", code: "042137", ttlMinutes: 10 };

describe("buildReauthEmail", () => {
  test("English", () => {
    const m = buildReauthEmail({ ...base, locale: "en" });
    expect(m.subject).toBe("[KTRG] Confirm it's you");
    expect(m.text).toContain("042137");
    expect(m.text).toContain("valid for 10 minutes");
    expect(m.text).toContain("do not enter the code");
    expect(m.html).toContain('<html lang="en">');
  });

  test("Japanese", () => {
    const m = buildReauthEmail({ ...base, locale: "ja" });
    expect(m.subject).toBe("【KTRG】本人確認コード");
    expect(m.text).toContain("042137");
    expect(m.text).toContain("10分間有効");
    expect(m.html).toContain('<html lang="ja">');
  });

  test("reads differently from the login email, so a re-check is never mistaken for a sign-in", () => {
    for (const locale of ["ja", "en"] as const) {
      expect(buildReauthEmail({ ...base, locale }).subject).not.toBe(buildOtpEmail({ ...base, locale }).subject);
    }
  });

  test("the code is not in the subject, and there is no link", () => {
    for (const locale of ["ja", "en"] as const) {
      const m = buildReauthEmail({ ...base, locale });
      expect(m.subject).not.toContain("042137");
      expect(m.text).not.toMatch(/https?:\/\//);
      expect(m.html).not.toContain('href="');
    }
  });
});
