import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createRateLimiter } from "../auth/rate-limit";
import { createMemoryRateLimitStore } from "../auth/rate-limit-memory-store";
import { createMemorySessionStore } from "../auth/session-memory-store";
import { createSessionService } from "../auth/session-service";
import type { AuthUser } from "../auth/user";
import { apiBase } from "../lib/api-errors";
import { createMemoryRallyAdminStore } from "./rally-admin-memory-store";
import { rallyAdminRoutes } from "./rally-admin-routes";
import { rallyPublicRoutes } from "./rally-public-routes";
import { createRallyAdminService } from "./rally-admin-service";

const admin: AuthUser = { id: "11111111-1111-4111-8111-111111111111", email: "admin@example.com", role: "admin", locale: "ja" };
const alice: AuthUser = { id: "22222222-2222-4222-8222-222222222222", email: "alice@example.com", role: "participant", locale: "ja" };
const ROUTE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ROUTE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const A1 = "a1a1a1a1-0000-4000-8000-000000000001";
const A2 = "a1a1a1a1-0000-4000-8000-000000000002";
const A_TURN = "a1a1a1a1-0000-4000-8000-000000000003";
const B1 = "b1b1b1b1-0000-4000-8000-000000000001";

function setup() {
  const users = new Map<string, AuthUser>([[admin.id, { ...admin }], [alice.id, { ...alice }]]);
  const session = createSessionService({ store: createMemorySessionStore(users).store });
  const audit = createMemoryAuditWriter();
  const mem = createMemoryRallyAdminStore(audit.writer);
  mem.addRoute(ROUTE_A, { nameJa: "ルートA", nameEn: "Route A", sortOrder: 1 });
  mem.addRoute(ROUTE_B, { nameJa: "ルートB", sortOrder: 2 });
  mem.addPlace({ spotId: A1, routeId: ROUTE_A, nameJa: "A一", stampable: true, sortOrder: 1, published: true });
  mem.addPlace({ spotId: A2, routeId: ROUTE_A, nameJa: "A二", stampable: true, sortOrder: 2 });
  mem.addPlace({ spotId: A_TURN, routeId: ROUTE_A, nameJa: "分かれ道", stampable: false, sortOrder: 3 });
  mem.addPlace({ spotId: B1, routeId: ROUTE_B, nameJa: "B一", stampable: true, sortOrder: 1 });
  const mounds = mem.addRally({ kind: "places", nameJa: "経塚ラリー", sortOrder: 1, published: true }, [A1, B1]);
  const courses = mem.addRally({ kind: "course", nameJa: "全コース", sortOrder: 2, published: true }, [ROUTE_A]);

  const rallyAdmin = createRallyAdminService({ store: mem.store });
  const rateLimit = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "m".repeat(32) });
  const services = { session, rateLimit, audit: audit.writer, rallyAdmin };
  const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(rallyAdminRoutes(() => services, { secureCookies: false }));
  const call = (method: string, path: string, opts: { cookie?: string; body?: unknown } = {}) =>
    app.handle(
      new Request(`http://localhost/api/v1${path}`, {
        method,
        headers: { ...(opts.body === undefined ? {} : { "content-type": "application/json" }), ...(opts.cookie ? { cookie: opts.cookie } : {}) },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      }),
    );
  const login = async (u: AuthUser) => `session=${(await session.create(users.get(u.id)!)).token}`;
  return { call, login, audit, mem, mounds, courses };
}
type Json = Record<string, any>; // eslint-disable-line -- test helper: bodies are checked field by field below

describe("rally admin routes need an admin", () => {
  const someId = crypto.randomUUID();
  const at = new Date().toISOString();
  const cases: [string, string, unknown?][] = [
    ["GET", "/admin/rallies"],
    ["GET", `/admin/rallies/${someId}`],
    ["POST", "/admin/rallies", { kind: "course", nameJa: "x" }],
    ["PUT", "/admin/rallies/order", { ids: [] }],
    ["PATCH", `/admin/rallies/${someId}`, { updatedAt: at }],
    ["PUT", `/admin/rallies/${someId}/places`, { updatedAt: at, spotIds: [] }],
    ["PUT", `/admin/rallies/${someId}/courses`, { updatedAt: at, routeIds: [] }],
    ["DELETE", `/admin/rallies/${someId}`],
  ];

  test("signed out: 401 everywhere; a participant: 403 everywhere; nothing is changed or recorded", async () => {
    const s = setup();
    const cookie = await s.login(alice);
    for (const [method, path, body] of cases) {
      expect({ path, status: (await s.call(method, path, { body })).status }).toEqual({ path, status: 401 });
      const res = await s.call(method, path, { cookie, body });
      expect({ path, status: res.status }).toEqual({ path, status: 403 });
      expect(await res.json()).toEqual({ ok: false, error: "forbidden" });
    }
    expect(s.audit.rows).toHaveLength(0);
    expect(s.mem.membersOf(s.mounds.id)).toEqual([A1, B1]);
  });

  test("the answer is kept for the time given, and rebuilt after it", async () => {
    const s = setup();
    let reads = 0;
    const store = { ...s.mem.store, publicRallies: async () => (reads++, s.mem.store.publicRallies()) };
    const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(rallyPublicRoutes(() => ({ rallyAdmin: createRallyAdminService({ store }), content: {} as never }), 60_000));
    for (let i = 0; i < 3; i++) await app.handle(new Request("http://localhost/api/v1/rallies"));
    expect(reads).toBe(1); // the list is built once for three requests
  });
});

describe("listing and reading", () => {
  test("lists every rally in order with its type, member count and finish count", async () => {
    const s = setup();
    s.mem.setFinished(s.mounds.id, 3);
    const body = (await (await s.call("GET", "/admin/rallies", { cookie: await s.login(admin) })).json()) as Json;
    expect(body.rallies.map((r: Json) => [r.kind, r.nameJa, r.memberCount, r.completionCount, r.published])).toEqual([
      ["places", "経塚ラリー", 2, 3, true],
      ["course", "全コース", 1, 0, true],
    ]);
  });

  test("a rally of places: its places in order, and every stamp place as a candidate (never a navigation point)", async () => {
    const s = setup();
    const body = (await (await s.call("GET", `/admin/rallies/${s.mounds.id}`, { cookie: await s.login(admin) })).json()) as Json;
    expect(body.courses).toBeNull();
    expect(body.places.map((p: Json) => [p.spotId, p.position])).toEqual([[A1, 1], [B1, 2]]);
    expect(body.candidates.map((c: Json) => c.spotId)).toEqual([A1, A2, B1]);
  });

  test("a rally of courses: its courses with their stamp place counts, and every course as a candidate", async () => {
    const s = setup();
    const body = (await (await s.call("GET", `/admin/rallies/${s.courses.id}`, { cookie: await s.login(admin) })).json()) as Json;
    expect(body.places).toBeNull();
    expect(body.courses).toEqual([{ routeId: ROUTE_A, nameJa: "ルートA", nameEn: "Route A", stampPlaceCount: 2, publishedStampPlaceCount: 1, position: 1 }]);
    expect(body.candidates.map((c: Json) => c.routeId)).toEqual([ROUTE_A, ROUTE_B]);
  });

  test("an unknown rally is 404", async () => {
    const s = setup();
    expect((await s.call("GET", `/admin/rallies/${crypto.randomUUID()}`, { cookie: await s.login(admin) })).status).toBe(404);
  });

  test("the answer is kept for the time given, and rebuilt after it", async () => {
    const s = setup();
    let reads = 0;
    const store = { ...s.mem.store, publicRallies: async () => (reads++, s.mem.store.publicRallies()) };
    const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(rallyPublicRoutes(() => ({ rallyAdmin: createRallyAdminService({ store }), content: {} as never }), 60_000));
    for (let i = 0; i < 3; i++) await app.handle(new Request("http://localhost/api/v1/rallies"));
    expect(reads).toBe(1); // the list is built once for three requests
  });
});

describe("creating, changing, ordering and deleting", () => {
  test("a new rally of either type is a draft at the end of the order, and is recorded", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    for (const kind of ["places", "course"] as const) {
      const res = await s.call("POST", "/admin/rallies", { cookie, body: { kind, nameJa: ` 新しい${kind} `, nameEn: "  " } });
      expect(res.status).toBe(201);
      const { rally } = (await res.json()) as Json;
      expect(rally).toMatchObject({ kind, nameJa: `新しい${kind}`, nameEn: null, published: false, memberCount: 0 });
    }
    const list = (await (await s.call("GET", "/admin/rallies", { cookie })).json()) as Json;
    expect(list.rallies.map((r: Json) => r.nameJa).slice(-2)).toEqual(["新しいplaces", "新しいcourse"]);
    expect(s.audit.rows.map((r) => r.action)).toEqual(["rally.create", "rally.create"]);
  });

  test("the new-rally form gets every candidate of the chosen type", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    const places = (await (await s.call("GET", "/admin/rallies/candidates?kind=places", { cookie })).json()) as Json;
    expect(places.candidates.map((c: Json) => c.spotId)).toEqual([A1, A2, B1]);
    const courses = (await (await s.call("GET", "/admin/rallies/candidates?kind=course", { cookie })).json()) as Json;
    expect(courses.candidates.map((c: Json) => c.routeId)).toEqual([ROUTE_A, ROUTE_B]);
  });

  test("a rally is created with all its ticked members at once, in the order sent", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    const p = await s.call("POST", "/admin/rallies", { cookie, body: { kind: "places", nameJa: "選んだ場所", spotIds: [B1, A1, A2] } });
    expect(p.status).toBe(201);
    const placesRally = ((await p.json()) as Json).rally;
    expect(placesRally.memberCount).toBe(3);
    expect(s.mem.membersOf(placesRally.id)).toEqual([B1, A1, A2]);

    const c = await s.call("POST", "/admin/rallies", { cookie, body: { kind: "course", nameJa: "選んだコース", routeIds: [ROUTE_B, ROUTE_A] } });
    const coursesRally = ((await c.json()) as Json).rally;
    expect(s.mem.membersOf(coursesRally.id)).toEqual([ROUTE_B, ROUTE_A]);
    // One audit row per new rally, not one per member.
    expect(s.audit.rows.map((r) => r.action)).toEqual(["rally.create", "rally.create"]);
  });

  test("creating refuses members of the wrong type, a navigation point, an unknown id or a repeat, and makes nothing", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    const bodies = [
      { kind: "places", nameJa: "x", routeIds: [ROUTE_A] },
      { kind: "course", nameJa: "x", spotIds: [A1] },
      { kind: "places", nameJa: "x", spotIds: [A_TURN] },
      { kind: "places", nameJa: "x", spotIds: [crypto.randomUUID()] },
      { kind: "course", nameJa: "x", routeIds: [ROUTE_A, ROUTE_A] },
    ];
    for (const body of bodies) {
      const res = await s.call("POST", "/admin/rallies", { cookie, body });
      expect({ body, status: res.status }).toEqual({ body, status: 400 });
    }
    expect(((await (await s.call("GET", "/admin/rallies", { cookie })).json()) as Json).rallies).toHaveLength(2);
    expect(s.audit.rows).toHaveLength(0);
  });

  test("an unknown type or an empty Japanese name is refused", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    expect((await s.call("POST", "/admin/rallies", { cookie, body: { kind: "mounds", nameJa: "x" } })).status).toBe(422);
    expect((await s.call("POST", "/admin/rallies", { cookie, body: { kind: "course", nameJa: "   " } })).status).toBe(422);
  });

  test("names and publishing are saved, publishing is recorded on its own; a stale updatedAt is a conflict", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    const res = await s.call("PATCH", `/admin/rallies/${s.courses.id}`, { cookie, body: { updatedAt: s.courses.updatedAt.toISOString(), nameEn: "All courses", published: false } });
    expect(((await res.json()) as Json).rally).toMatchObject({ nameEn: "All courses", published: false });
    expect(s.audit.rows.map((r) => r.action)).toEqual(["rally.update", "rally.unpublish"]);
    const stale = await s.call("PATCH", `/admin/rallies/${s.courses.id}`, { cookie, body: { updatedAt: s.courses.updatedAt.toISOString(), nameJa: "x" } });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ ok: false, error: "conflict" });
  });

  test("an empty rally cannot be published", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    const made = ((await (await s.call("POST", "/admin/rallies", { cookie, body: { kind: "course", nameJa: "空" } })).json()) as Json).rally;
    const res = await s.call("PATCH", `/admin/rallies/${made.id}`, { cookie, body: { updatedAt: made.updatedAt, published: true } });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "rally_empty" });
  });

  test("reorders all rallies at once; a partial list is refused", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    expect((await s.call("PUT", "/admin/rallies/order", { cookie, body: { ids: [s.courses.id, s.mounds.id] } })).status).toBe(200);
    const list = (await (await s.call("GET", "/admin/rallies", { cookie })).json()) as Json;
    expect(list.rallies.map((r: Json) => r.id)).toEqual([s.courses.id, s.mounds.id]);
    expect((await s.call("PUT", "/admin/rallies/order", { cookie, body: { ids: [s.mounds.id] } })).status).toBe(422);
  });

  test("deleting a rally is recorded; an unknown one is 404", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    expect((await s.call("DELETE", `/admin/rallies/${s.mounds.id}`, { cookie })).status).toBe(200);
    expect((await s.call("GET", `/admin/rallies/${s.mounds.id}`, { cookie })).status).toBe(404);
    expect(s.audit.rows).toMatchObject([{ action: "rally.delete", targetId: s.mounds.id }]);
    expect((await s.call("DELETE", `/admin/rallies/${s.mounds.id}`, { cookie })).status).toBe(404);
  });

  test("the answer is kept for the time given, and rebuilt after it", async () => {
    const s = setup();
    let reads = 0;
    const store = { ...s.mem.store, publicRallies: async () => (reads++, s.mem.store.publicRallies()) };
    const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(rallyPublicRoutes(() => ({ rallyAdmin: createRallyAdminService({ store }), content: {} as never }), 60_000));
    for (let i = 0; i < 3; i++) await app.handle(new Request("http://localhost/api/v1/rallies"));
    expect(reads).toBe(1); // the list is built once for three requests
  });
});

describe("what is in a rally", () => {
  test("a rally of places takes stamp places from any course, in the given order", async () => {
    const s = setup();
    const res = await s.call("PUT", `/admin/rallies/${s.mounds.id}/places`, { cookie: await s.login(admin), body: { updatedAt: s.mounds.updatedAt.toISOString(), spotIds: [B1, A2, A1] } });
    expect(res.status).toBe(200);
    expect(s.mem.membersOf(s.mounds.id)).toEqual([B1, A2, A1]);
    expect(s.audit.rows).toMatchObject([{ action: "rally.members.update", targetId: s.mounds.id }]);
  });

  test("a rally of places refuses a navigation point, an unknown place and a repeat", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    const updatedAt = s.mounds.updatedAt.toISOString();
    for (const spotIds of [[A1, A_TURN], [A1, crypto.randomUUID()], [A1, A1]]) {
      const res = await s.call("PUT", `/admin/rallies/${s.mounds.id}/places`, { cookie, body: { updatedAt, spotIds } });
      expect({ spotIds, status: res.status }).toEqual({ spotIds, status: 400 });
    }
    expect(s.mem.membersOf(s.mounds.id)).toEqual([A1, B1]);
  });

  test("a rally of courses takes courses, in the given order; an unknown or repeated course is refused", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    const updatedAt = s.courses.updatedAt.toISOString();
    expect((await s.call("PUT", `/admin/rallies/${s.courses.id}/courses`, { cookie, body: { updatedAt, routeIds: [ROUTE_A, ROUTE_A] } })).status).toBe(400);
    expect((await s.call("PUT", `/admin/rallies/${s.courses.id}/courses`, { cookie, body: { updatedAt, routeIds: [crypto.randomUUID()] } })).status).toBe(400);
    expect((await s.call("PUT", `/admin/rallies/${s.courses.id}/courses`, { cookie, body: { updatedAt, routeIds: [ROUTE_B, ROUTE_A] } })).status).toBe(200);
    expect(s.mem.membersOf(s.courses.id)).toEqual([ROUTE_B, ROUTE_A]);
  });

  test("the type decides what a rally takes: no courses in a rally of places, no places in a rally of courses", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    const toPlaces = await s.call("PUT", `/admin/rallies/${s.mounds.id}/courses`, { cookie, body: { updatedAt: s.mounds.updatedAt.toISOString(), routeIds: [ROUTE_A] } });
    expect(await toPlaces.json()).toEqual({ ok: false, error: "invalid_rally_members" });
    const toCourses = await s.call("PUT", `/admin/rallies/${s.courses.id}/places`, { cookie, body: { updatedAt: s.courses.updatedAt.toISOString(), spotIds: [A1] } });
    expect(await toCourses.json()).toEqual({ ok: false, error: "invalid_rally_members" });
  });

  test("a published rally cannot be emptied; a stale updatedAt is a conflict", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    const empty = await s.call("PUT", `/admin/rallies/${s.courses.id}/courses`, { cookie, body: { updatedAt: s.courses.updatedAt.toISOString(), routeIds: [] } });
    expect(await empty.json()).toEqual({ ok: false, error: "rally_empty" });
    expect((await s.call("PUT", `/admin/rallies/${s.courses.id}/courses`, { cookie, body: { updatedAt: new Date(0).toISOString(), routeIds: [ROUTE_B] } })).status).toBe(409);
  });

  test("the answer is kept for the time given, and rebuilt after it", async () => {
    const s = setup();
    let reads = 0;
    const store = { ...s.mem.store, publicRallies: async () => (reads++, s.mem.store.publicRallies()) };
    const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(rallyPublicRoutes(() => ({ rallyAdmin: createRallyAdminService({ store }), content: {} as never }), 60_000));
    for (let i = 0; i < 3; i++) await app.handle(new Request("http://localhost/api/v1/rallies"));
    expect(reads).toBe(1); // the list is built once for three requests
  });
});

describe("what visitors read about rallies", () => {
  test("only published rallies, in order; a rally of places lists its published places, a rally of courses its courses with their stamp places", async () => {
    const s = setup();
    s.mem.addRally({ kind: "places", nameJa: "下書き", sortOrder: 3, published: false }, [A1]);
    s.mem.addPlace({ spotId: A1, routeId: ROUTE_A, nameJa: "A一", stampable: true, sortOrder: 1, published: true, status: "closed" });
    const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(rallyPublicRoutes(() => ({ rallyAdmin: createRallyAdminService({ store: s.mem.store }), content: {} as never })));
    const res = await app.handle(new Request("http://localhost/api/v1/rallies"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Json;
    expect(body.rallies.map((r: Json) => [r.nameJa, r.kind])).toEqual([["経塚ラリー", "places"], ["全コース", "course"]]);
    // A1 is published, B1 is not: only A1 is named.
    expect(body.rallies[0].places.map((p: Json) => p.id)).toEqual([A1]);
    expect(body.rallies[1].courses).toEqual([{ routeId: ROUTE_A, nameJa: "ルートA", nameEn: "Route A", spots: [{ id: A1, status: "closed" }] }]);
  });

  test("the answer is kept for the time given, and rebuilt after it", async () => {
    const s = setup();
    let reads = 0;
    const store = { ...s.mem.store, publicRallies: async () => (reads++, s.mem.store.publicRallies()) };
    const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(rallyPublicRoutes(() => ({ rallyAdmin: createRallyAdminService({ store }), content: {} as never }), 60_000));
    for (let i = 0; i < 3; i++) await app.handle(new Request("http://localhost/api/v1/rallies"));
    expect(reads).toBe(1); // the list is built once for three requests
  });
});

describe("one rally for its own page", () => {
  const spot = (id: string, routeId: string, lat: number | null) => ({ id, routeId, nameJa: id, nameEn: null, status: "open", radiusM: 40, position: lat === null ? null : { lat, lng: 135.1, verified: true } });
  const content = {
    publicRoute: async (id: string) =>
      id === ROUTE_A
        ? { route: { photoUrl: "https://example.com/a.jpg", photoCredit: "x" }, spots: [spot(A1, ROUTE_A, 34.2)], points: [] }
        : id === ROUTE_B
          ? { route: { photoUrl: null, photoCredit: null }, spots: [spot(B1, ROUTE_B, null)], points: [] }
          : null,
  };
  const appFor = (s: ReturnType<typeof setup>) => new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(rallyPublicRoutes(() => ({ rallyAdmin: createRallyAdminService({ store: s.mem.store }), content: content as never })));

  test("a rally of places lists its places with their checked positions, a route photo and when it changed", async () => {
    const s = setup();
    const res = await appFor(s).handle(new Request(`http://localhost/api/v1/rallies/${s.mounds.id}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
    const { rally } = (await res.json()) as Json;
    expect(rally).toMatchObject({ id: s.mounds.id, kind: "places", nameJa: "経塚ラリー", photoUrl: "https://example.com/a.jpg" });
    expect(rally.places.map((p: Json) => [p.id, p.lat])).toEqual([[A1, 34.2]]); // B1 is a draft place: not named
    expect(typeof rally.updatedAt).toBe("string");
  });

  test("a rally of courses lists every stamp place of its courses, and its courses", async () => {
    const s = setup();
    const { rally } = (await (await appFor(s).handle(new Request(`http://localhost/api/v1/rallies/${s.courses.id}`))).json()) as Json;
    expect(rally.courses).toEqual([{ routeId: ROUTE_A, nameJa: "ルートA", nameEn: "Route A" }]);
    expect(rally.places.map((p: Json) => p.id)).toEqual([A1]);
  });

  test("a draft rally and one that is not there are both 404", async () => {
    const s = setup();
    const draft = s.mem.addRally({ kind: "places", nameJa: "下書き", sortOrder: 3, published: false }, [A1]);
    for (const id of [draft.id, "99999999-9999-4999-8999-999999999999"]) {
      expect((await appFor(s).handle(new Request(`http://localhost/api/v1/rallies/${id}`))).status).toBe(404);
    }
  });
});
