import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createRateLimiter } from "../auth/rate-limit";
import { createMemoryRateLimitStore } from "../auth/rate-limit-memory-store";
import { createMemorySessionStore } from "../auth/session-memory-store";
import { createSessionService } from "../auth/session-service";
import type { AuthUser } from "../auth/user";
import { apiBase } from "../lib/api-errors";
import { stampAdminRoutes } from "./stamp-admin-routes";
import { createMemoryStampStore } from "./stamp-memory-store";
import { stampRoutes } from "./stamp-routes";
import { createStampService } from "./stamp-service";
import type { StampSpot } from "./stamp-types";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- test answers

const admin: AuthUser = { id: "11111111-1111-4111-8111-111111111111", email: "admin@example.com", role: "admin", locale: "ja" };
const alice: AuthUser = { id: "22222222-2222-4222-8222-222222222222", email: "alice@example.com", role: "participant", locale: "ja" };
const bob: AuthUser = { id: "33333333-3333-4333-8333-333333333333", email: "bob@example.com", role: "participant", locale: "ja" };

const SPOT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HERE = { lat: 34.3, lng: 135.1 };
const spot = (over: Partial<StampSpot> = {}): StampSpot => ({
  id: SPOT_ID, published: true, stampable: true, positionVerified: true, ...HERE, radiusM: 50, status: "open", ...over,
});

async function setup() {
  const users = new Map<string, AuthUser>([admin, alice, bob].map((u) => [u.id, { ...u }]));
  const session = createSessionService({ store: createMemorySessionStore(users).store });
  const audit = createMemoryAuditWriter();
  const mem = createMemoryStampStore(audit.writer);
  mem.spots.set(SPOT_ID, spot());
  const rateLimit = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "m".repeat(32) });
  const services = { session, rateLimit, audit: audit.writer, stamps: createStampService({ store: mem.store }) };
  const app = new Elysia({ prefix: "/api/v1" })
    .use(apiBase())
    .use(stampRoutes(() => services, { secureCookies: false }))
    .use(stampAdminRoutes(() => services, { secureCookies: false }));
  const call = (method: string, path: string, opts: { cookie?: string; body?: unknown } = {}) =>
    app.handle(
      new Request(`http://localhost/api/v1${path}`, {
        method,
        headers: { ...(opts.body === undefined ? {} : { "content-type": "application/json" }), ...(opts.cookie ? { cookie: opts.cookie } : {}) },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      }),
    );
  const login = async (u: AuthUser) => `session=${(await session.create(users.get(u.id)!)).token}`;
  const cookies = { admin: await login(admin), alice: await login(alice), bob: await login(bob) };
  const stamp = (cookie: string, body: Json = {}) =>
    call("POST", "/stamps", { cookie, body: { spotId: SPOT_ID, ...HERE, accuracyM: 10, ...body } });
  const answer = async (res: Response) => [res.status, ((await res.json()) as Json).error] as const;
  return { call, cookies, stamp, answer, mem, audit };
}

describe("collecting a stamp", () => {
  test("a visitor near the place gets the stamp once; stamping again is a no-op", async () => {
    const { stamp, cookies, call } = await setup();
    const first = await stamp(cookies.alice);
    expect(first.status).toBe(200);
    const body = (await first.json()) as Json;
    expect(body.stamp).toMatchObject({ spotId: SPOT_ID, flagged: false, alreadyStamped: false });

    const again = (await (await stamp(cookies.alice)).json()) as Json;
    expect(again.stamp).toMatchObject({ alreadyStamped: true, createdAt: body.stamp.createdAt });

    const mine = (await (await call("GET", "/stamps", { cookie: cookies.alice })).json()) as Json;
    expect(mine.stamps).toHaveLength(1);
  });

  test("user B never sees user A's stamps, and stamps for themselves only", async () => {
    const { stamp, cookies, call } = await setup();
    await stamp(cookies.alice);
    const bobs = (await (await call("GET", "/stamps", { cookie: cookies.bob })).json()) as Json;
    expect(bobs.stamps).toEqual([]);
    expect(((await (await stamp(cookies.bob)).json()) as Json).stamp.alreadyStamped).toBe(false);
  });

  test("too far, rough GPS, closed place: refused with their own codes", async () => {
    const { stamp, cookies, answer, mem } = await setup();
    expect(await answer(await stamp(cookies.alice, { lat: HERE.lat + 0.01 }))).toEqual([409, "too_far"]);
    expect(await answer(await stamp(cookies.alice, { accuracyM: 101 }))).toEqual([422, "gps_accuracy_poor"]);
    mem.spots.set(SPOT_ID, spot({ status: "closed" }));
    expect(await answer(await stamp(cookies.alice))).toEqual([409, "spot_closed"]);
    expect(mem.stamps.size).toBe(0);
  });

  test("a place that is a draft, not a stamp place, unchecked, or unknown looks missing", async () => {
    const { stamp, cookies, answer, mem } = await setup();
    for (const over of [{ published: false }, { stampable: false }, { positionVerified: false }, { lat: null, lng: null }]) {
      mem.spots.set(SPOT_ID, spot(over));
      expect(await answer(await stamp(cookies.alice))).toEqual([404, "not_found"]);
    }
    expect(await answer(await stamp(cookies.alice, { spotId: crypto.randomUUID() }))).toEqual([404, "not_found"]);
  });

  test("accuracy of 50 m or worse is accepted but flagged for review", async () => {
    const { stamp, cookies, call } = await setup();
    const res = (await (await stamp(cookies.alice, { accuracyM: 60 })).json()) as Json;
    expect(res.stamp.flagged).toBe(true);
    const queue = (await (await call("GET", "/admin/stamps", { cookie: cookies.admin })).json()) as Json;
    expect(queue.stamps).toHaveLength(1);
    expect(queue.stamps[0]).toMatchObject({ spotId: SPOT_ID, userId: alice.id, flagReason: "low_accuracy", revokedAt: null });
  });

  test("the limits: 49 m is clean, 50 m is flagged, 100 m is accepted, 101 m is refused; exactly on the radius is near enough", async () => {
    const { stamp, cookies, answer, mem } = await setup();
    const flagged = async (body: Json, who = cookies.alice) => ((await (await stamp(who, body)).json()) as Json).stamp.flagged;
    expect(await flagged({ accuracyM: 49 })).toBe(false);
    mem.stamps.clear();
    expect(await flagged({ accuracyM: 50 })).toBe(true);
    mem.stamps.clear();
    expect(await flagged({ accuracyM: 100 })).toBe(true);
    expect(await answer(await stamp(cookies.bob, { accuracyM: 100.1 }))).toEqual([422, "gps_accuracy_poor"]);
    // A point a hair inside, and a hair outside, the 50 m radius (0.00045 degrees of latitude is about 50.04 m).
    mem.stamps.clear();
    expect((await stamp(cookies.alice, { lat: HERE.lat + 0.00044 })).status).toBe(200);
    expect(await answer(await stamp(cookies.bob, { lat: HERE.lat + 0.00046 }))).toEqual([409, "too_far"]);
  });

  test("what the store says was finished reaches the answer", async () => {
    const { mem, stamp, cookies } = await setup();
    const real = mem.store.award;
    mem.store.award = async (...args) => ({ ...(await real(...args)), finished: { routeIds: ["r1"], rallyIds: ["y1", "y2"] } });
    const res = (await (await stamp(cookies.alice)).json()) as Json;
    expect(res.stamp.finished).toEqual({ routeIds: ["r1"], rallyIds: ["y1", "y2"] });
  });

  test("the stored stamp and the answer carry no coordinates", async () => {
    const { stamp, cookies, mem } = await setup();
    const text = JSON.stringify(await (await stamp(cookies.alice, { lat: 34.30001 })).json());
    expect(text).not.toContain("34.30001");
    expect(JSON.stringify([...mem.stamps.values()])).not.toContain("135.1");
  });

  test("bad input is 422; no login is 401; too many tries is 429", async () => {
    const { stamp, cookies, call } = await setup();
    expect((await stamp(cookies.alice, { lat: 91 })).status).toBe(422);
    expect((await stamp(cookies.alice, { accuracyM: -1 })).status).toBe(422);
    expect((await stamp(cookies.alice, { spotId: "nope" })).status).toBe(422);
    expect((await call("GET", "/stamps")).status).toBe(401);
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await stamp(cookies.bob, { lat: HERE.lat + 0.01 })).status;
    expect(last).toBe(429);
  });
});

describe("reviewing flagged stamps", () => {
  test("a participant cannot reach the review routes", async () => {
    const { call, cookies } = await setup();
    const id = crypto.randomUUID();
    for (const [method, path] of [["GET", "/admin/stamps"], ["POST", `/admin/stamps/${id}/revoke`], ["POST", `/admin/stamps/${id}/restore`]] as const) {
      expect((await call(method, path, { cookie: cookies.alice })).status).toBe(403);
      expect((await call(method, path)).status).toBe(401);
    }
  });

  test("revoking hides the stamp from its owner and is audited; restoring brings it back", async () => {
    const { stamp, call, cookies, audit, answer } = await setup();
    await stamp(cookies.alice, { accuracyM: 60 });
    const id = (((await (await call("GET", "/admin/stamps", { cookie: cookies.admin })).json()) as Json).stamps[0] as Json).id as string;

    expect((await call("POST", `/admin/stamps/${id}/revoke`, { cookie: cookies.admin })).status).toBe(200);
    expect(((await (await call("GET", "/stamps", { cookie: cookies.alice })).json()) as Json).stamps).toEqual([]);
    expect(((await (await call("GET", "/admin/stamps", { cookie: cookies.admin })).json()) as Json).stamps).toEqual([]);
    expect(((await (await call("GET", "/admin/stamps?revoked=true", { cookie: cookies.admin })).json()) as Json).stamps).toHaveLength(1);
    // The record stays: stamping again is refused with its own code, not "already stamped" with nothing to show.
    expect(await answer(await stamp(cookies.alice))).toEqual([409, "stamp_revoked"]);

    expect((await call("POST", `/admin/stamps/${id}/restore`, { cookie: cookies.admin })).status).toBe(200);
    expect(((await (await call("GET", "/stamps", { cookie: cookies.alice })).json()) as Json).stamps).toHaveLength(1);
    expect(audit.rows.map((r) => [r.action, r.targetId, r.actorUserId])).toEqual([
      ["stamp.revoke", id, admin.id],
      ["stamp.restore", id, admin.id],
    ]);
  });

  test("revoking twice changes nothing the second time: same time, no second audit row", async () => {
    const { stamp, call, cookies, audit, mem } = await setup();
    await stamp(cookies.alice, { accuracyM: 60 });
    const id = [...mem.stamps.keys()][0]!;
    await call("POST", `/admin/stamps/${id}/revoke`, { cookie: cookies.admin });
    const at = mem.stamps.get(id)!.revokedAt;
    expect((await call("POST", `/admin/stamps/${id}/revoke`, { cookie: cookies.admin })).status).toBe(200);
    expect(mem.stamps.get(id)!.revokedAt).toBe(at);
    expect(audit.rows).toHaveLength(1);
  });

  test("an unknown stamp is 404", async () => {
    const { call, cookies, answer } = await setup();
    expect(await answer(await call("POST", `/admin/stamps/${crypto.randomUUID()}/revoke`, { cookie: cookies.admin }))).toEqual([404, "not_found"]);
  });
});
