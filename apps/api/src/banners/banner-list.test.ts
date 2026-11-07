import { describe, expect, test } from "bun:test";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createBannerService, createMemoryBannerStore } from "./banner-list";

const actor = "11111111-1111-4111-8111-111111111111";
const banner = (over: Record<string, unknown> = {}) => ({ imageUrl: " https://img.example.com/a.jpg ", altJa: " 朝日 ", altEn: "  ", published: false, ...over });

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

  test("visitors get published banners only, in order", async () => {
    const s = setup();
    await s.svc.create(actor, banner({ altJa: "一", published: true }));
    await s.svc.create(actor, banner({ altJa: "下書き" }));
    await s.svc.create(actor, banner({ altJa: "三", published: true }));
    expect((await s.svc.publicBanners()).map((b) => b.altJa)).toEqual(["一", "三"]);
  });
});

test("a new banner goes last, and the arrows set the order visitors see", async () => {
  const s = setup();
  const a = await s.svc.create(actor, banner({ altJa: "一", published: true }));
  const b = await s.svc.create(actor, banner({ altJa: "二", published: true }));
  const c = await s.svc.create(actor, banner({ altJa: "三" }));
  if (!a.ok || !b.ok || !c.ok) throw new Error("not created");
  expect((await s.svc.ordered()).map((x) => x.altJa)).toEqual(["一", "二", "三"]);

  expect(await s.svc.reorder(actor, [c.value.id, b.value.id, a.value.id])).toBe(true);
  expect((await s.svc.ordered()).map((x) => x.altJa)).toEqual(["三", "二", "一"]);
  expect((await s.svc.publicBanners()).map((x) => x.altJa)).toEqual(["二", "一"]);
});

test("the order must name every banner once", async () => {
  const s = setup();
  const a = await s.svc.create(actor, banner({ altJa: "一" }));
  const b = await s.svc.create(actor, banner({ altJa: "二" }));
  if (!a.ok || !b.ok) throw new Error("not created");
  expect(await s.svc.reorder(actor, [a.value.id])).toBe(false);
  expect(await s.svc.reorder(actor, [a.value.id, a.value.id])).toBe(false);
  expect((await s.svc.ordered()).map((x) => x.altJa)).toEqual(["一", "二"]);
});
