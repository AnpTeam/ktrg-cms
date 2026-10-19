import { beforeEach, describe, expect, test } from "bun:test";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createMemoryContentStore } from "./content-memory-store";
import { createContentService } from "./content-service";
import type { RouteRow, SpotRow } from "./content-types";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const LINE = { type: "LineString", coordinates: [[135, 34], [135, 34.01]] };

let audit: ReturnType<typeof createMemoryAuditWriter>;
let mem: ReturnType<typeof createMemoryContentStore>;
let svc: ReturnType<typeof createContentService>;

beforeEach(() => {
  audit = createMemoryAuditWriter();
  mem = createMemoryContentStore(audit.writer);
  svc = createContentService({ store: mem.store });
});

async function route(fields: Record<string, unknown> = {}): Promise<RouteRow> {
  const r = await svc.createRoute(ADMIN, { nameJa: "甲山から孝子越え", ...fields });
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}
async function spot(routeId: string, fields: Record<string, unknown> = {}): Promise<SpotRow> {
  const r = await svc.createSpot(ADMIN, routeId, { nameJa: "虎島の経塚", ...fields });
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

describe("routes", () => {
  test("a stale updatedAt is a conflict and changes nothing; a fresh one saves", async () => {
    const r = await route();
    const first = await svc.updateRoute(ADMIN, r.id, r.updatedAt, { nameEn: "Koyama" });
    expect(first.ok).toBe(true);
    const stale = await svc.updateRoute(ADMIN, r.id, r.updatedAt, { nameEn: "Overwritten" });
    expect(stale).toEqual({ ok: false, reason: "conflict" });
    const now = await svc.getRoute(r.id);
    expect(now?.route.nameEn).toBe("Koyama");
    const second = await svc.updateRoute(ADMIN, r.id, first.ok ? first.value.updatedAt : r.updatedAt, { nameEn: "Koyama 2" });
    expect(second.ok).toBe(true);
  });

  test("the line is checked, simplified and sets the distance; a typed distance wins", async () => {
    const r = await route();
    const withLine = await svc.updateRoute(ADMIN, r.id, r.updatedAt, { geometry: LINE });
    expect(withLine.ok && withLine.value.distanceKm).toBe(1.11);
    const cur = withLine.ok ? withLine.value : r;
    const manual = await svc.updateRoute(ADMIN, r.id, cur.updatedAt, { geometry: LINE, distanceKm: 9.3 });
    expect(manual.ok && manual.value.distanceKm).toBe(9.3);
    const wiggle = { type: "LineString", coordinates: Array.from({ length: 6000 }, (_, i) => [135 + i * 1e-5, 34 + Math.sin(i / 5) * 4e-4]) };
    const big = await svc.updateRoute(ADMIN, r.id, manual.ok ? manual.value.updatedAt : r.updatedAt, { geometry: wiggle });
    expect(big.ok && (big.value.geometry?.coordinates.length ?? 0)).toBeLessThanOrEqual(2000);
  });

  test("bad lines and bad video links are refused", async () => {
    const r = await route();
    expect(await svc.updateRoute(ADMIN, r.id, r.updatedAt, { geometry: { type: "LineString", coordinates: [[135, 34]] } })).toEqual({ ok: false, reason: "invalid_line" });
    for (const url of ["https://example.com/v", "http://youtu.be/dQw4w9WgXcQ", "https://vimeo.com/abc"]) {
      expect(await svc.updateRoute(ADMIN, r.id, r.updatedAt, { videoUrl: url })).toEqual({ ok: false, reason: "invalid_video_url" });
    }
    expect((await svc.updateRoute(ADMIN, r.id, r.updatedAt, { videoUrl: "https://youtu.be/dQw4w9WgXcQ" })).ok).toBe(true);
  });

  test("a blank Japanese name is refused; blank optional text becomes empty", async () => {
    expect(await svc.createRoute(ADMIN, { nameJa: "   " })).toEqual({ ok: false, reason: "validation_failed" });
    const r = await route({ nameEn: "  " });
    expect(r.nameEn).toBeNull();
  });

  test("a route with places cannot be deleted; an empty one can", async () => {
    const r = await route();
    await spot(r.id);
    expect(await svc.deleteRoute(ADMIN, r.id)).toEqual({ ok: false, reason: "route_has_places" });
    const empty = await route({ nameJa: "空" });
    expect((await svc.deleteRoute(ADMIN, empty.id)).ok).toBe(true);
    expect(await svc.deleteRoute(ADMIN, empty.id)).toEqual({ ok: false, reason: "not_found" });
  });

  test("reordering needs every route exactly once", async () => {
    const a = await route({ nameJa: "A" });
    const b = await route({ nameJa: "B" });
    expect((await svc.reorderRoutes(ADMIN, [b.id, a.id])).ok).toBe(true);
    expect((await svc.listRoutes()).map((x) => x.nameJa)).toEqual(["B", "A"]);
    expect((await svc.reorderRoutes(ADMIN, [b.id])).ok).toBe(false);
    expect((await svc.reorderRoutes(ADMIN, [b.id, b.id])).ok).toBe(false);
  });
});

describe("places", () => {
  test("a new place is a draft and joins its route's course rally only", async () => {
    const r = await route();
    const s = await spot(r.id);
    expect(s).toMatchObject({ published: false, positionVerified: false, radiusM: 50, lat: null });
    expect(mem.courseRallySpotIds(r.id)).toEqual([s.id]);
  });

  test("publishing fails in order: no coordinates, position not checked, no permission", async () => {
    const r = await route();
    const s = await spot(r.id);
    expect(await svc.publishSpot(ADMIN, s.id)).toEqual({ ok: false, reason: "no_coordinates" });
    const placed = await svc.updateSpot(ADMIN, s.id, s.updatedAt, { lat: 34.3, lng: 135.1 });
    if (!placed.ok) throw new Error(placed.reason);
    expect(await svc.publishSpot(ADMIN, s.id)).toEqual({ ok: false, reason: "position_not_verified" });
    const checked = await svc.updateSpot(ADMIN, s.id, placed.value.updatedAt, { positionVerified: true, positionSource: "葛城修験 公式サイト" });
    if (!checked.ok) throw new Error(checked.reason);
    expect(await svc.publishSpot(ADMIN, s.id)).toEqual({ ok: false, reason: "permission_required" });
    const allowed = await svc.updateSpot(ADMIN, s.id, checked.value.updatedAt, { permissionConfirmed: true, permissionNote: "寺の住職" });
    if (!allowed.ok) throw new Error(allowed.reason);
    const published = await svc.publishSpot(ADMIN, s.id);
    expect(published.ok && published.value.published).toBe(true);
  });

  test("checking a position needs a source; moving a place cancels the check", async () => {
    const r = await route();
    const s = await spot(r.id, { lat: 34.3, lng: 135.1 });
    expect(await svc.updateSpot(ADMIN, s.id, s.updatedAt, { positionVerified: true })).toEqual({ ok: false, reason: "source_required" });
    const ok = await svc.updateSpot(ADMIN, s.id, s.updatedAt, { positionVerified: true, positionSource: "公式サイト" });
    if (!ok.ok) throw new Error(ok.reason);
    const moved = await svc.updateSpot(ADMIN, s.id, ok.value.updatedAt, { lat: 34.31, lng: 135.1 });
    expect(moved.ok && moved.value.positionVerified).toBe(false);
  });

  test("a published place cannot be moved without checking the new position", async () => {
    const r = await route();
    const s = await spot(r.id, { lat: 34.3, lng: 135.1, positionVerified: true, positionSource: "公式", permissionConfirmed: true });
    const pub = await svc.publishSpot(ADMIN, s.id);
    if (!pub.ok) throw new Error(pub.reason);
    expect(await svc.updateSpot(ADMIN, s.id, pub.value.updatedAt, { lat: 34.5, lng: 135.1 })).toEqual({ ok: false, reason: "position_not_verified" });
    expect(await svc.updateSpot(ADMIN, s.id, pub.value.updatedAt, { permissionConfirmed: false })).toEqual({ ok: false, reason: "permission_required" });
  });

  test("a position is both numbers or neither", async () => {
    const r = await route();
    const s = await spot(r.id);
    expect(await svc.updateSpot(ADMIN, s.id, s.updatedAt, { lat: 34.3 })).toEqual({ ok: false, reason: "validation_failed" });
  });

  test("a stamped place cannot be deleted; unpublishing hides it", async () => {
    const r = await route();
    const s = await spot(r.id, { lat: 34.3, lng: 135.1, positionVerified: true, positionSource: "公式", permissionConfirmed: true });
    await svc.publishSpot(ADMIN, s.id);
    mem.stampPlace(s.id);
    expect(await svc.deleteSpot(ADMIN, s.id)).toEqual({ ok: false, reason: "spot_has_stamps" });
    await svc.unpublishSpot(ADMIN, s.id);
    expect(await svc.publicSpot(s.id)).toBeNull();
  });
});

describe("what visitors see", () => {
  test("all routes are listed; places only when published; coordinates only when checked", async () => {
    const r = await route({ geometry: LINE });
    const draft = await spot(r.id, { nameJa: "下書き" });
    const live = await spot(r.id, { nameJa: "公開", lat: 34.3, lng: 135.1, positionVerified: true, positionSource: "公式", permissionConfirmed: true });
    await svc.publishSpot(ADMIN, live.id);
    await route({ nameJa: "準備中のルート" });

    const list = await svc.publicRoutes();
    expect(list.map((x) => [x.nameJa, x.status])).toEqual([["甲山から孝子越え", "ready"], ["準備中のルート", "soon"]]);
    const detail = await svc.publicRoute(r.id);
    expect(detail?.spots.map((s) => s.nameJa)).toEqual(["公開"]);
    expect(detail?.spots[0]?.position).toEqual({ lat: 34.3, lng: 135.1, verified: true });
    expect(detail?.route.line).toBeNull(); // the line is a draft until a person has checked it
    expect(detail?.route.sketch).toBeNull();
    expect(detail?.route.bounds).toBeNull();
    expect(await svc.publicSpot(draft.id)).toBeNull();
  });

  test("a checked line is shown; redrawing it hides it again until it is checked again", async () => {
    const r = await route({ geometry: LINE });
    expect((await svc.publicRoute(r.id))?.route.line).toBeNull();
    expect(await svc.updateRoute(ADMIN, r.id, r.updatedAt, { lineVerified: true })).toEqual({ ok: false, reason: "source_required" });
    const checked = await svc.updateRoute(ADMIN, r.id, r.updatedAt, { lineVerified: true, lineSource: "葛城修験 公式サイト" });
    if (!checked.ok) throw new Error(checked.reason);
    const shown = (await svc.publicRoute(r.id))?.route;
    expect(shown?.line?.coordinates).toHaveLength(2);
    expect(shown?.bounds).not.toBeNull();
    expect(shown?.sketch).not.toBeNull();
    const redrawn = await svc.updateRoute(ADMIN, r.id, checked.value.updatedAt, { geometry: { type: "LineString", coordinates: [[135, 34], [135.02, 34.02]] } });
    expect(redrawn.ok && redrawn.value.lineVerified).toBe(false);
    expect((await svc.publicRoute(r.id))?.route.line).toBeNull();
  });

  test("a route with no line cannot be marked as checked", async () => {
    const r = await route();
    expect(await svc.updateRoute(ADMIN, r.id, r.updatedAt, { lineVerified: true, lineSource: "公式" })).toEqual({ ok: false, reason: "invalid_line" });
  });
});

describe("audit", () => {
  test("every change records one entry with the admin and the target, ids only", async () => {
    const r = await route();
    const s = await spot(r.id);
    await svc.updateRoute(ADMIN, r.id, r.updatedAt, { nameEn: "x" });
    await svc.updateSpot(ADMIN, s.id, s.updatedAt, { status: "closed" });
    const actions = audit.rows.map((x) => x.action);
    expect(actions).toEqual(["route.create", "spot.create", "route.update", "spot.update", "spot.status.change"]);
    expect(audit.rows.every((x) => x.actorUserId === ADMIN)).toBe(true);
    expect(audit.rows[0]?.targetId).toBe(r.id);
  });
});
