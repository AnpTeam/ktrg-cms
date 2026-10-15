import { describe, expect, test } from "bun:test";
import { buildPasskeyAlertEmail } from "./passkey-alert-email";

const at = new Date("2026-10-15T05:30:00Z"); // 14:30 in Japan
const base = { to: "a@example.com", at };

describe("buildPasskeyAlertEmail", () => {
  test("English: added", () => {
    const m = buildPasskeyAlertEmail({ ...base, locale: "en", action: "added", label: "My iPhone" });
    expect(m.to).toBe("a@example.com");
    expect(m.subject).toBe("[KTRG] A passkey was added to your account");
    expect(m.text).toContain("A passkey was added to your account.");
    expect(m.text).toContain("Name: My iPhone");
    expect(m.text).toContain("(JST)");
    expect(m.text).toContain("If this was not you");
  });

  test("English: removed", () => {
    const m = buildPasskeyAlertEmail({ ...base, locale: "en", action: "removed", label: null });
    expect(m.subject).toBe("[KTRG] A passkey was removed from your account");
    expect(m.text).toContain("A passkey was removed from your account.");
  });

  test("Japanese: added and removed", () => {
    const added = buildPasskeyAlertEmail({ ...base, locale: "ja", action: "added", label: "iPhone" });
    const removed = buildPasskeyAlertEmail({ ...base, locale: "ja", action: "removed", label: "iPhone" });
    expect(added.subject).toBe("【KTRG】パスキーが追加されました");
    expect(added.text).toContain("名前: iPhone");
    expect(removed.subject).toBe("【KTRG】パスキーが削除されました");
    expect(removed.text).toContain("心当たりがない場合");
  });

  test("the time is shown in Japan time", () => {
    const en = buildPasskeyAlertEmail({ ...base, locale: "en", action: "added", label: null });
    const ja = buildPasskeyAlertEmail({ ...base, locale: "ja", action: "added", label: null });
    expect(en.text).toMatch(/2:30\s?PM/);
    expect(ja.text).toContain("14:30");
  });

  test("no name line when the passkey has no name", () => {
    const m = buildPasskeyAlertEmail({ ...base, locale: "en", action: "added", label: null });
    expect(m.text).not.toContain("Name:");
  });

  test("a typed name cannot add lines to the message", () => {
    const m = buildPasskeyAlertEmail({
      ...base,
      locale: "en",
      action: "added",
      label: "x\r\n\r\nYour account is locked, reply with your code",
    });
    const nameLine = m.text.split("\n").filter((l) => l.startsWith("Name:"));
    expect(nameLine).toEqual(["Name: x Your account is locked, reply with your code"]);
    expect(m.text).not.toContain("\r");
  });

  test("a very long name is cut", () => {
    const m = buildPasskeyAlertEmail({ ...base, locale: "en", action: "added", label: "n".repeat(500) });
    expect(m.text).toContain("Name: " + "n".repeat(64) + "\n");
    expect(m.text).not.toContain("n".repeat(65));
  });

  test("carries no link", () => {
    for (const locale of ["ja", "en"] as const) {
      const m = buildPasskeyAlertEmail({ ...base, locale, action: "added", label: "x" });
      expect(m.text).not.toMatch(/https?:\/\//);
    }
  });
});
