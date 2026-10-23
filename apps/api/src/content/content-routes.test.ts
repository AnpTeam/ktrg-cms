import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createRateLimiter } from "../auth/rate-limit";
import { createMemoryRateLimitStore } from "../auth/rate-limit-memory-store";
import { createMemorySessionStore } from "../auth/session-memory-store";
import { createSessionService } from "../auth/session-service";
import type { AuthUser } from "../auth/user";
import { apiBase } from "../lib/api-errors";
import type { RoutingService } from "../routing/routing-service";
import { adminContentRoutes } from "./admin-routes";
import { createMemoryContentStore } from "./content-memory-store";
import { createContentService } from "./content-service";
import { publicContentRoutes } from "./public-routes";

const admin: AuthUser = { id: "11111111-1111-4111-8111-111111111111", email: "admin@example.com", role: "admin", locale: "ja" };
const alice: AuthUser = { id: "22222222-2222-4222-8222-222222222222", email: "alice@example.com", role: "participant", locale: "ja" };
const LINE = { type: "LineString", coordinates: [[135, 34], [135.01, 34.01]] };

const NO_ROUTING: RoutingService = { snap: async () => ({ ok: false, reason: "routing_unavailable" }) };

function setup(routing: RoutingService = NO_ROUTING) {
  const users = new Map<string, AuthUser>([[admin.id, { ...admin }], [alice.id, { ...alice }]]);
  const session = createSessionService({ store: createMemorySessionStore(users).store });
  const audit = createMemoryAuditWriter();
  const mem = createMemoryContentStore(audit.writer);
  const content = createContentService({ store: mem.store });
  const rateLimit = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "m".repeat(32) });
  const services = { session, rateLimit, audit: audit.writer, content, routing };
  const app = new Elysia({ prefix: "/api/v1" })
    .use(apiBase())
    .use(adminContentRoutes(() => services, { secureCookies: false }))
    .use(publicContentRoutes(() => content));
  const call = (method: string, path: string, opts: { cookie?: string; body?: unknown; ifNoneMatch?: string } = {}) =>
    app.handle(
      new Request(`http://localhost/api/v1${path}`, {
        method,
        headers: {
          ...(opts.body === undefined ? {} : { "content-type": "application/json" }),
          ...(opts.cookie ? { cookie: opts.cookie } : {}),
          ...(opts.ifNoneMatch ? { "if-none-match": opts.ifNoneMatch } : {}),
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      }),
    );
  const login = async (u: AuthUser) => `session=${(await session.create(users.get(u.id)!)).token}`;
  return { call, login, audit, mem };
}
type Json = Record<string, any>; // eslint-disable-line -- test helper: bodies are checked field by field below

describe("admin routes need an admin", () => {
  const someId = crypto.randomUUID();
  const cases: [string, string, unknown?][] = [
    ["GET", "/admin/routes"],
    ["GET", `/admin/routes/${someId}`],
    ["POST", "/admin/routes", { nameJa: "x" }],
    ["PUT", "/admin/routes/order", { ids: [] }],
    ["PATCH", `/admin/routes/${someId}`, { updatedAt: new Date().toISOString() }],
    ["DELETE", `/admin/routes/${someId}`],
    ["POST", `/admin/routes/${someId}/spots`, { nameJa: "x" }],
    ["PUT", `/admin/routes/${someId}/spots/order`, { ids: [] }],
    ["PATCH", `/admin/spots/${someId}`, { updatedAt: new Date().toISOString() }],
    ["POST", `/admin/spots/${someId}/publish`],
    ["POST", `/admin/spots/${someId}/unpublish`],
    ["DELETE", `/admin/spots/${someId}`],
    ["POST", "/admin/route-snap", { points: [{ lat: 34, lng: 135 }, { lat: 34.1, lng: 135.1 }] }],
  ];

  test("signed out: 401 on every route, with one fixed body", async () => {
    const { call } = setup();
    for (const [method, path, body] of cases) {
      const res = await call(method, path, { body });
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 401 });
      expect(await res.json()).toEqual({ ok: false, error: "unauthenticated" });
    }
  });

  test("a participant: 403 on every route, and nothing changes", async () => {
    const { call, login, audit } = setup();
    const cookie = await login(alice);
    for (const [method, path, body] of cases) {
      const res = await call(method, path, { cookie, body });
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 403 });
      expect(await res.json()).toEqual({ ok: false, error: "forbidden" });
    }
    expect(audit.rows).toHaveLength(0);
  });
});

describe("an admin edits a route and its places", () => {
  async function created() {
    const s = setup();
    const cookie = await s.login(admin);
    const res = await s.call("POST", "/admin/routes", { cookie, body: { nameJa: "甲山から孝子越え", prefecture: "wakayama" } });
    expect(res.status).toBe(201);
    const route = ((await res.json()) as Json).route as Json;
    return { ...s, cookie, route };
  }

  test("other languages: saved per field, trimmed, cleared with null, English untouched, never shown to visitors", async () => {
    const { call, cookie, route } = await created();
    const patch = async (updatedAt: unknown, translations: unknown) =>
      ((await (await call("PATCH", `/admin/routes/${route.id}`, { cookie, body: { updatedAt, translations } })).json()) as Json).route as Json;
    const first = await patch(route.updatedAt, { de: { name: "  Koyama-Weg ", description: "Text" }, th: { name: "   " } });
    expect(first.translations).toEqual({ de: { name: "Koyama-Weg", description: "Text" } });
    expect(first.nameEn).toBeNull();
    const second = await patch(first.updatedAt, { de: { name: null }, fr: { name: "Chemin" } });
    expect(second.translations).toEqual({ de: { description: "Text" }, fr: { name: "Chemin" } });
    // A language the site does not offer is dropped, like any unknown field.
    const unknown = await patch(second.updatedAt, { xx: { name: "?" } });
    expect(unknown.translations).toEqual(second.translations);
    const visitor = (await (await call("GET", `/routes/${route.id}`)).json()) as Json;
    expect(Object.keys(visitor.route as Json)).not.toContain("translations");
  });

  test("create, read back, save with updatedAt, and a stale save is 409 conflict", async () => {
    const { call, cookie, route } = await created();
    expect(route).toMatchObject({ nameJa: "甲山から孝子越え", prefecture: "wakayama" });
    const ok = await call("PATCH", `/admin/routes/${route.id}`, { cookie, body: { updatedAt: route.updatedAt, nameEn: "Koyama", geometry: LINE, walkStyle: "out_and_back" } });
    expect(ok.status).toBe(200);
    const saved = ((await ok.json()) as Json).route as Json;
    expect(saved).toMatchObject({ nameEn: "Koyama", distanceKm: 1.44, walkStyle: "out_and_back" });
    const stale = await call("PATCH", `/admin/routes/${route.id}`, { cookie, body: { updatedAt: route.updatedAt, nameEn: "Overwritten" } });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ ok: false, error: "conflict" });
    const got = ((await (await call("GET", `/admin/routes/${route.id}`, { cookie })).json()) as Json).route as Json;
    expect(got.nameEn).toBe("Koyama");
  });

  test("the grading levels are saved and can be cleared", async () => {
    const { call, cookie, route } = await created();
    const patch = (body: unknown, updatedAt: string) => call("PATCH", `/admin/routes/${route.id}`, { cookie, body: { updatedAt, ...(body as object) } });
    const first = await patch({ physicalLevel: 3, technicalLevel: "B", nameKana: " ともがしま " }, route.updatedAt);
    expect(first.status).toBe(200);
    const got = async () => ((await (await call("GET", `/admin/routes/${route.id}`, { cookie })).json()) as Json).route as Json;
    const saved = await got();
    expect(saved).toMatchObject({ physicalLevel: 3, technicalLevel: "B", nameKana: "ともがしま" });
    expect((await patch({ physicalLevel: null, technicalLevel: null }, saved.updatedAt as string)).status).toBe(200);
    expect(await got()).toMatchObject({ physicalLevel: null, technicalLevel: null });
  });

  test("bad input: 400 invalid_line / invalid_video_url, 422 for the wrong shape", async () => {
    const { call, cookie, route } = await created();
    const patch = (body: unknown) => call("PATCH", `/admin/routes/${route.id}`, { cookie, body: { updatedAt: route.updatedAt, ...(body as object) } });
    const line = await patch({ geometry: { type: "LineString", coordinates: [[135, 34]] } });
    expect([line.status, await line.json()]).toEqual([400, { ok: false, error: "invalid_line" }]);
    const video = await patch({ videoUrl: "https://example.com/x" });
    expect([video.status, await video.json()]).toEqual([400, { ok: false, error: "invalid_video_url" }]);
    expect((await patch({ prefecture: "tokyo" })).status).toBe(422);
    expect((await patch({ walkStyle: "zigzag" })).status).toBe(422);
    expect((await patch({ distanceKm: -1 })).status).toBe(422);
    expect((await patch({ physicalLevel: 0 })).status).toBe(422);
    expect((await patch({ physicalLevel: 11 })).status).toBe(422);
    expect((await patch({ technicalLevel: "F" })).status).toBe(422);
    expect((await call("PATCH", `/admin/routes/not-a-uuid`, { cookie, body: { updatedAt: route.updatedAt } })).status).toBe(422);
    expect((await call("POST", "/admin/routes", { cookie, body: { nameJa: "" } })).status).toBe(422);
  });

  test("a place: draft first, publishing is refused for each missing rule, then works, and visitors see it", async () => {
    const { call, cookie, route } = await created();
    const made = await call("POST", `/admin/routes/${route.id}/spots`, { cookie, body: { nameJa: "虎島の経塚", lat: 34.3, lng: 135.1 } });
    expect(made.status).toBe(201);
    let spot = ((await made.json()) as Json).spot as Json;
    const publish = () => call("POST", `/admin/spots/${spot.id}/publish`, { cookie });
    const refusal = async () => {
      const r = await publish();
      return [r.status, ((await r.json()) as Json).error];
    };
    expect(await refusal()).toEqual([409, "position_not_verified"]);
    const checked = await call("PATCH", `/admin/spots/${spot.id}`, { cookie, body: { updatedAt: spot.updatedAt, positionVerified: true } });
    expect([checked.status, ((await checked.json()) as Json).error]).toEqual([400, "source_required"]);
    const withSource = await call("PATCH", `/admin/spots/${spot.id}`, { cookie, body: { updatedAt: spot.updatedAt, positionVerified: true, positionSource: "公式サイト" } });
    spot = ((await withSource.json()) as Json).spot as Json;
    expect(await refusal()).toEqual([409, "permission_required"]);
    const allowed = await call("PATCH", `/admin/spots/${spot.id}`, { cookie, body: { updatedAt: spot.updatedAt, permissionConfirmed: true } });
    spot = ((await allowed.json()) as Json).spot as Json;

    // Not public yet.
    expect((await call("GET", `/spots/${spot.id}`)).status).toBe(404);
    expect((await publish()).status).toBe(200);
    const pub = (await (await call("GET", `/spots/${spot.id}`)).json()) as Json;
    expect(pub.spot).toMatchObject({ nameJa: "虎島の経塚", position: { lat: 34.3, lng: 135.1, verified: true } });
    const detail = (await (await call("GET", `/routes/${route.id}`)).json()) as Json;
    expect(detail.spots).toHaveLength(1);
    expect(detail.route.status).toBe("ready");
    expect((await call("POST", `/admin/spots/${spot.id}/unpublish`, { cookie })).status).toBe(200);
    expect((await call("GET", `/spots/${spot.id}`)).status).toBe(404);
  });

  test("GET /spots/status: published places only, 304 on the same ETag, new ETag after a status change", async () => {
    const { call, cookie, route } = await created();
    const made = await call("POST", `/admin/routes/${route.id}/spots`, { cookie, body: { nameJa: "虎島の経塚", lat: 34.3, lng: 135.1 } });
    let spot = ((await made.json()) as Json).spot as Json;
    const patch = async (body: object) => {
      spot = ((await (await call("PATCH", `/admin/spots/${spot.id}`, { cookie, body: { updatedAt: spot.updatedAt, ...body } })).json()) as Json).spot as Json;
    };
    await patch({ positionVerified: true, positionSource: "公式サイト", permissionConfirmed: true });

    const draft = (await (await call("GET", "/spots/status")).json()) as Json;
    expect(draft.spots).toEqual([]);

    spot = ((await (await call("POST", `/admin/spots/${spot.id}/publish`, { cookie })).json()) as Json).spot as Json; // publishing moves updatedAt
    const first = await call("GET", "/spots/status");
    const etag = first.headers.get("etag")!;
    expect(((await first.json()) as Json).spots).toEqual([
      { id: spot.id, status: "open", statusNoteJa: null, statusNoteEn: null, statusUpdatedAt: null },
    ]);

    const same = await call("GET", "/spots/status", { ifNoneMatch: etag });
    expect([same.status, await same.text()]).toEqual([304, ""]);

    await patch({ status: "closed", statusNoteJa: "落石のため通行止め" });
    const changed = await call("GET", "/spots/status", { ifNoneMatch: etag });
    expect([changed.status, changed.headers.get("etag") === etag]).toEqual([200, false]);
    expect(((await changed.json()) as Json).spots[0]).toMatchObject({ status: "closed", statusNoteJa: "落石のため通行止め" });
  });

  test("deleting a route that still has a place is 409 route_has_places", async () => {
    const { call, cookie, route } = await created();
    await call("POST", `/admin/routes/${route.id}/spots`, { cookie, body: { nameJa: "場所" } });
    const res = await call("DELETE", `/admin/routes/${route.id}`, { cookie });
    expect([res.status, await res.json()]).toEqual([409, { ok: false, error: "route_has_places" }]);
  });

  test("a missing route or place is 404", async () => {
    const { call, cookie } = await created();
    const id = crypto.randomUUID();
    expect((await call("GET", `/admin/routes/${id}`, { cookie })).status).toBe(404);
    expect((await call("POST", `/admin/spots/${id}/publish`, { cookie })).status).toBe(404);
    expect((await call("GET", `/routes/${id}`)).status).toBe(404);
  });

  test("changes are audited with the admin's id", async () => {
    const { call, cookie, route, audit } = await created();
    await call("PATCH", `/admin/routes/${route.id}`, { cookie, body: { updatedAt: route.updatedAt, nameEn: "x" } });
    expect(audit.rows.map((r) => [r.action, r.actorUserId])).toEqual([["route.create", admin.id], ["route.update", admin.id]]);
  });
});

describe("what visitors read", () => {
  test("no login needed; every route is listed, with coming-soon ones marked", async () => {
    const { call, login } = setup();
    const cookie = await login(admin);
    await call("POST", "/admin/routes", { cookie, body: { nameJa: "準備中のルート" } });
    const res = await call("GET", "/routes");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Json;
    expect(body.routes.map((r: Json) => [r.nameJa, r.status])).toEqual([["準備中のルート", "soon"]]);
  });

  test("a drawn line is not sent until it is checked against a source", async () => {
    const { call, login } = setup();
    const cookie = await login(admin);
    const route = ((await (await call("POST", "/admin/routes", { cookie, body: { nameJa: "R", geometry: LINE } })).json()) as Json).route as Json;
    const read = async () => ((await (await call("GET", `/routes/${route.id}`)).json()) as Json).route as Json;
    expect(route.lineVerified).toBe(false);
    expect((await read()).line).toBeNull();
    expect((await (await call("GET", "/routes")).json() as Json).routes[0]).toMatchObject({ sketch: null, bounds: null });
    const noSource = await call("PATCH", `/admin/routes/${route.id}`, { cookie, body: { updatedAt: route.updatedAt, lineVerified: true } });
    expect([noSource.status, ((await noSource.json()) as Json).error]).toEqual([400, "source_required"]);
    const ok = await call("PATCH", `/admin/routes/${route.id}`, { cookie, body: { updatedAt: route.updatedAt, lineVerified: true, lineSource: "公式サイト" } });
    expect(ok.status).toBe(200);
    expect((await read()).line.coordinates).toHaveLength(2);
  });

  test("an unchecked position is never sent, even for a published place", async () => {
    const { call, login, mem } = setup();
    const cookie = await login(admin);
    const route = (((await (await call("POST", "/admin/routes", { cookie, body: { nameJa: "R" } })).json()) as Json).route) as Json;
    const spot = (((await (await call("POST", `/admin/routes/${route.id}/spots`, { cookie, body: { nameJa: "S", lat: 34.3, lng: 135.1 } })).json()) as Json).spot) as Json;
    // Force a published, unchecked place straight into the store to prove the public view filters on its own.
    await mem.store.setPublished(admin.id, spot.id, true);
    const detail = (await (await call("GET", `/routes/${route.id}`)).json()) as Json;
    expect(detail.spots[0].position).toBeNull();
  });

});

describe("snapping a line to trails", () => {
  const body = { points: [{ lat: 34.25, lng: 135.2 }, { lat: 34.26, lng: 135.21 }] };

  test("an admin gets the line the service found", async () => {
    const seen: unknown[] = [];
    const routing: RoutingService = { snap: async (points) => (seen.push(points), { ok: true, line: [[135.2, 34.25, 10], [135.205, 34.255, 15], [135.21, 34.26, 20]], distanceM: 1500 }) };
    const { call, login } = setup(routing);
    const res = await call("POST", "/admin/route-snap", { cookie: await login(admin), body });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, line: [[135.2, 34.25, 10], [135.205, 34.255, 15], [135.21, 34.26, 20]], distanceM: 1500 });
    expect(seen).toEqual([body.points]);
  });

  test("each refusal of the service has its own status and code", async () => {
    const cases: [Extract<Parameters<typeof JSON.stringify>[0], unknown> & string, number][] = [
      ["routing_unavailable", 503],
      ["routing_no_route", 422],
      ["routing_failed", 502],
    ];
    for (const [reason, status] of cases) {
      const routing = { snap: async () => ({ ok: false as const, reason }) } as RoutingService;
      const { call, login } = setup(routing);
      const res = await call("POST", "/admin/route-snap", { cookie: await login(admin), body });
      expect([res.status, ((await res.json()) as Json).error]).toEqual([status, reason]);
    }
  });

  test("without a key the answer is 'not set up', never a crash", async () => {
    const { call, login } = setup();
    const res = await call("POST", "/admin/route-snap", { cookie: await login(admin), body });
    expect([res.status, ((await res.json()) as Json).error]).toEqual([503, "routing_unavailable"]);
  });

  test("fewer than two points, too many points and positions out of range are refused before the service is asked", async () => {
    let asked = 0;
    const routing: RoutingService = { snap: async () => (asked++, { ok: false, reason: "routing_failed" }) };
    const { call, login } = setup(routing);
    const cookie = await login(admin);
    const point = { lat: 34, lng: 135 };
    for (const points of [[point], [], Array.from({ length: 51 }, () => point), [point, { lat: 95, lng: 135 }], [point, { lat: 34, lng: 200 }]]) {
      const res = await call("POST", "/admin/route-snap", { cookie, body: { points } });
      expect(res.status).toBe(422);
    }
    expect(asked).toBe(0);
  });
});
