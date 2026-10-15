import { describe, expect, test } from "bun:test";
import { buildDeletionRequestEmail } from "./deletion-request";

const at = new Date("2026-10-15T05:30:00Z"); // 14:30 in Japan

describe("buildDeletionRequestEmail", () => {
  test("English", () => {
    const m = buildDeletionRequestEmail({ to: "a@example.com", locale: "en", at });
    expect(m.to).toBe("a@example.com");
    expect(m.subject).toBe("[KTRG] We received your request to delete your account");
    expect(m.text).toMatch(/2:30\s?PM \(JST\)/);
    expect(m.text).toContain("cancel the request");
    expect(m.text).toContain("If this was not you");
    expect(m.html).toContain('<html lang="en">');
  });

  test("Japanese", () => {
    const m = buildDeletionRequestEmail({ to: "a@example.com", locale: "ja", at });
    expect(m.subject).toBe("【KTRG】アカウント削除のリクエストを受け付けました");
    expect(m.text).toContain("14:30");
    expect(m.text).toContain("取り消し");
    expect(m.html).toContain('<html lang="ja">');
  });

  test("carries no link", () => {
    for (const locale of ["ja", "en"] as const) {
      const m = buildDeletionRequestEmail({ to: "a@example.com", locale, at });
      expect(m.text).not.toMatch(/https?:\/\//);
      expect(m.html).not.toContain('href="');
    }
  });
});
