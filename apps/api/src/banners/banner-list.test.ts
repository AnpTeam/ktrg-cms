import { describe, expect, test } from "bun:test";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createBannerService, createMemoryBannerStore } from "./banner-list";

const actor = "11111111-1111-4111-8111-111111111111";
const banner = (over: Record<string, unknown> = {}) => ({ imageUrl: " https://img.example.com/a.jpg ", altJa: " 朝日 ", altEn: "  ", sortOrder: 0, published: false, ...over });

function setup() {
  const audit = createMemoryAuditWriter();
  const mem = createMemoryBannerStore(audit.writer);
  return { svc: createBannerService({ store: mem.store }), audit };
}

describe("banners", () => {
  test("cleaned on save: trimmed link and description, blank English cleared; audited", async () => {
    const s = setup();
    const r = await s.svc.create(actor, banner());
    expect(r.ok && r.value).toMatchObject({ imageUrl: "https://img.example.com/a.jpg", altJa: "朝日", altEn: null });
    expect(s.audit.rows.map((a) => a.action)).toEqual(["banner.create"]);
  });

  test("refused: a photo link that is not https, a description that is only spaces", async () => {
    const s = setup();
    expect(await s.svc.create(actor, banner({ imageUrl: "http://img.example.com/a.jpg" }))).toEqual({ ok: false, reason: "invalid_photo_url" });
    expect(await s.svc.create(actor, banner({ altJa: "   " }))).toEqual({ ok: false, reason: "validation_failed" });
  });

  test("visitors get published banners only, smallest order number first", async () => {
    const s = setup();
    await s.svc.create(actor, banner({ altJa: "三", sortOrder: 3, published: true }));
    await s.svc.create(actor, banner({ altJa: "下書き", sortOrder: 0 }));
    await s.svc.create(actor, banner({ altJa: "一", sortOrder: 1, published: true }));
    expect((await s.svc.publicBanners()).map((b) => b.altJa)).toEqual(["一", "三"]);
  });
});
