import { describe, expect, test } from "bun:test";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createMemorySitePageStore, createSitePageService } from "./site-pages";

const actor = "11111111-1111-4111-8111-111111111111";
const page = (over: Record<string, unknown> = {}) => ({ slug: "access-guide", titleJa: " アクセス ", titleEn: " ", bodyJa: "## 電車\n駅から歩きます。", bodyEn: null, published: false, ...over });

function setup() {
  const audit = createMemoryAuditWriter();
  return { svc: createSitePageService({ store: createMemorySitePageStore(audit.writer).store }), audit };
}

describe("pages editors make", () => {
  test("cleaned on save, audited, and visitors see it only once published", async () => {
    const { svc, audit } = setup();
    const made = await svc.create(actor, page({ slug: " Access-Guide " }));
    if (!made.ok) throw new Error("not made");
    expect(made.value).toMatchObject({ slug: "access-guide", titleJa: "アクセス", titleEn: null });
    expect(audit.rows.map((r) => r.action)).toEqual(["site_page.create"]);
    expect(await svc.published("access-guide")).toBeNull();
    const saved = await svc.update(actor, made.value.id, made.value.updatedAt.toISOString(), { published: true });
    expect(saved.ok).toBe(true);
    expect((await svc.published("access-guide"))?.titleJa).toBe("アクセス");
    expect((await svc.listPublished()).map((p) => p.slug)).toEqual(["access-guide"]);
  });

  test("an address is lower-case letters, digits and hyphens, and used once", async () => {
    const { svc } = setup();
    for (const slug of ["", "Has Space", "日本語", "a/b", "-x", "x--y", "x_y"]) expect(await svc.create(actor, page({ slug }))).toMatchObject({ ok: false });
    expect((await svc.create(actor, page())).ok).toBe(true);
    expect(await svc.create(actor, page())).toEqual({ ok: false, reason: "conflict" });
  });

  test("a page can be deleted, and then it is gone", async () => {
    const { svc } = setup();
    const made = await svc.create(actor, page({ published: true }));
    if (!made.ok) throw new Error("not made");
    expect((await svc.remove(actor, made.value.id)).ok).toBe(true);
    expect(await svc.published("access-guide")).toBeNull();
  });
});
