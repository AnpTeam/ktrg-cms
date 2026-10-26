import { describe, expect, test } from "bun:test";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createMemoryPlaceStore, createPlaceService } from "./place-directory";

const actor = "11111111-1111-4111-8111-111111111111";
const place = (over: Record<string, unknown> = {}) => ({
  category: "cafe" as const,
  routeId: null,
  nameJa: " 喫茶 ",
  nameEn: "  ",
  descriptionJa: null,
  descriptionEn: null,
  hoursJa: null,
  hoursEn: null,
  closedDaysJa: null,
  closedDaysEn: null,
  lat: null,
  lng: null,
  positionVerified: false,
  positionSource: null,
  address: null,
  phone: null,
  website: null,
  photoUrl: null,
  status: "unknown" as const,
  lastVerified: null,
  listingConfirmed: false,
  listingNote: null,
  published: false,
  ...over,
});

function setup() {
  const audit = createMemoryAuditWriter();
  return { svc: createPlaceService({ store: createMemoryPlaceStore(audit.writer).store }), audit };
}

describe("places directory", () => {
  test("cleaned on save (trimmed, blank cleared) and audited", async () => {
    const s = setup();
    const r = await s.svc.create(actor, place());
    expect(r.ok && r.value).toMatchObject({ nameJa: "喫茶", nameEn: null });
    expect(s.audit.rows.map((a) => a.action)).toEqual(["place.create"]);
  });

  test("refused: one coordinate only, a website that is not a web link, 'checked' with no position or source", async () => {
    const s = setup();
    expect(await s.svc.create(actor, place({ lat: 34.2 }))).toEqual({ ok: false, reason: "validation_failed" });
    expect(await s.svc.create(actor, place({ website: "ftp://x.example" }))).toEqual({ ok: false, reason: "invalid_source_url" });
    expect(await s.svc.create(actor, place({ positionVerified: true }))).toEqual({ ok: false, reason: "no_coordinates" });
    expect(await s.svc.create(actor, place({ lat: 34.2, lng: 135.1, positionVerified: true }))).toEqual({ ok: false, reason: "source_required" });
  });

  test("publishing needs a checked position and the agreement to be listed", async () => {
    const s = setup();
    const base = { lat: 34.2, lng: 135.1, positionVerified: true, positionSource: "地図アプリ", published: true };
    expect(await s.svc.create(actor, place({ published: true }))).toEqual({ ok: false, reason: "no_coordinates" });
    expect(await s.svc.create(actor, place({ ...base, positionVerified: false, positionSource: null }))).toEqual({ ok: false, reason: "position_not_verified" });
    expect(await s.svc.create(actor, place(base))).toEqual({ ok: false, reason: "permission_required" });
    const ok = await s.svc.create(actor, place({ ...base, listingConfirmed: true }));
    expect(ok.ok).toBe(true);
  });

  test("visitors get published places with a checked position, and can ask for one course", async () => {
    const s = setup();
    const course = "22222222-2222-4222-8222-222222222222";
    const live = { lat: 34.2, lng: 135.1, positionVerified: true, positionSource: "地図アプリ", listingConfirmed: true, published: true };
    await s.svc.create(actor, place({ ...live, nameJa: "一", routeId: course }));
    await s.svc.create(actor, place({ ...live, nameJa: "二" }));
    await s.svc.create(actor, place({ nameJa: "下書き" }));
    expect((await s.svc.publicPlaces()).map((p) => p.nameJa).sort()).toEqual(["一", "二"]);
    expect((await s.svc.publicPlaces(course)).map((p) => p.nameJa)).toEqual(["一"]);
  });

  test("a route that does not exist is refused instead of failing in the database", async () => {
    const known = "22222222-2222-4222-8222-222222222222";
    const svc = createPlaceService({ store: createMemoryPlaceStore(createMemoryAuditWriter().writer).store, routeExists: async (id) => id === known });
    expect(await svc.create(actor, place({ routeId: "33333333-3333-4333-8333-333333333333" }))).toEqual({ ok: false, reason: "validation_failed" });
    expect((await svc.create(actor, place({ routeId: known }))).ok).toBe(true);
  });

  test("imports a field sheet as drafts, counts first, and skips what is already there", async () => {
    const audit = createMemoryAuditWriter();
    const svc = createPlaceService({ store: createMemoryPlaceStore(audit.writer).store, routeIds: async () => ["22222222-2222-4222-8222-222222222222"] });
    const csv = [
      "sample,place_id,category,name_ja,name_en,course_no,index,near_spot_ja,prefecture,municipality,address_ja,lat,lng,coord_source,status,last_verified,listing_permission",
      "見本,場所ID,種類,名前,名前,コース,#,近い,府県,市,住所,緯度,経度,出どころ,状態,日,了承",
      ",1,トイレ,公衆トイレ,Toilets,1,4,桟橋,和歌山県,和歌山市,住所,34.28,135.00,地図アプリで確認,営業中・利用可,2026/10/16,不要（公共施設）",
      ",2,飲食店,喫茶,Cafe,9,S,駅,和歌山県,和歌山市,住所,34.27,135.08,地図アプリで確認,営業中・利用可,2026/10/17,未確認",
    ].join("\n");
    expect(await svc.importSheet(actor, csv, false)).toMatchObject({ read: 2, added: 1, skipped: 0 });
    expect((await svc.list()).items).toHaveLength(0);
    const done = await svc.importSheet(actor, csv, true);
    expect(done).toMatchObject({ added: 1, failed: [{ name: "喫茶", reason: "course 9" }] });
    const [row] = (await svc.list()).items;
    expect(row).toMatchObject({ category: "toilet", positionVerified: false, published: false, listingConfirmed: true, lastVerified: "2026-10-16" });
    expect(await svc.importSheet(actor, csv, true)).toMatchObject({ added: 0, skipped: 1 });
  });
});
