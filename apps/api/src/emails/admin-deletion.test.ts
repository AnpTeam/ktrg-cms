import { expect, test } from "bun:test";
import { buildAdminDeletionEmail } from "./admin-deletion";

const at = new Date("2026-10-15T05:30:00Z");
const deleteOn = new Date("2026-10-22T05:30:00Z");

test("says who asked, when it happens and how to appeal, in the owner's language, with no link", () => {
  const ja = buildAdminDeletionEmail({ to: "a@example.com", locale: "ja", at, deleteOn });
  expect(ja.subject).toContain("管理者");
  expect(ja.text).toContain("7日後");
  expect(ja.text).toContain("異議");
  const en = buildAdminDeletionEmail({ to: "a@example.com", locale: "en", at, deleteOn });
  expect(en.subject).toContain("administrator");
  expect(en.text).toContain("in 7 days");
  expect(en.text).toContain("profile page");
  for (const m of [ja, en]) {
    expect(m.text).not.toMatch(/https?:\/\//);
    expect(m.html).not.toContain('href="');
  }
});
