import { describe, expect, test } from "bun:test";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createAuthorService, createMemoryAuthorStore } from "./author-list";

const actor = "11111111-1111-4111-8111-111111111111";

describe("blog writers", () => {
  test("cleaned on save; the photo must be an https address; audited", async () => {
    const audit = createMemoryAuditWriter();
    const svc = createAuthorService({ store: createMemoryAuthorStore(audit.writer).store });
    const made = await svc.create(actor, { nameJa: " 取材班 ", nameEn: "  ", photoUrl: " https://example.com/team.jpg " });
    expect(made.ok && made.value).toMatchObject({ nameJa: "取材班", nameEn: null, photoUrl: "https://example.com/team.jpg" });
    expect(await svc.create(actor, { nameJa: "  ", nameEn: null, photoUrl: null })).toMatchObject({ ok: false });
    expect(await svc.create(actor, { nameJa: "ゲスト", nameEn: null, photoUrl: "http://example.com/a.jpg" })).toMatchObject({ ok: false });
    expect(audit.rows.map((r) => r.action)).toEqual(["author.create"]);
  });
});
