import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createRateLimiter } from "../auth/rate-limit";
import { createMemoryRateLimitStore } from "../auth/rate-limit-memory-store";
import { createMemorySessionStore } from "../auth/session-memory-store";
import { createSessionService } from "../auth/session-service";
import type { AuthUser } from "../auth/user";
import { apiBase } from "../lib/api-errors";
import { createMemoryStampStore } from "../stamps/stamp-memory-store";
import { stampRoutes } from "../stamps/stamp-routes";
import { createStampService } from "../stamps/stamp-service";
import type { StampSpot } from "../stamps/stamp-types";
import { guestRoutes } from "./guest-routes";
import { createGuestService } from "./guest-service";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- test answers

const alice: AuthUser = { id: "22222222-2222-4222-8222-222222222222", email: "alice@example.com", role: "participant", locale: "ja" };
const SPOT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ROUTE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const HERE = { lat: 34.3, lng: 135.1 };
const spot: StampSpot = { id: SPOT_ID, routeId: ROUTE_ID, published: true, stampable: true, positionVerified: true, ...HERE, radiusM: 50, status: "open" };

async function setup() {
  const users = new Map<string, AuthUser>([[alice.id, { ...alice }]]);
  const session = createSessionService({ store: createMemorySessionStore(users).store });
  const audit = createMemoryAuditWriter();
  const mem = createMemoryStampStore(audit.writer);
  mem.spots.set(SPOT_ID, spot);
  const stamps = createStampService({ store: mem.store });
  const services = {
    session,
    audit: audit.writer,
    rateLimit: createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "m".repeat(32) }),
    stamps,
    guest: createGuestService({ stamps, secret: "g".repeat(32) }),
  };
  const opts = { secureCookies: false };
  const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(stampRoutes(() => services, opts)).use(guestRoutes(() => services, opts));
  const call = (method: string, path: string, o: { cookie?: string; body?: unknown } = {}) =>
    app.handle(
      new Request(`http://localhost/api/v1${path}`, {
        method,
        headers: { ...(o.body === undefined ? {} : { "content-type": "application/json" }), ...(o.cookie ? { cookie: o.cookie } : {}) },
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
      }),
    );
  const session1 = `session=${(await session.create(users.get(alice.id)!)).token}`;
  const stamp = (cookie?: string, body: Json = {}) => call("POST", "/guest/stamps", { cookie, body: { spotId: SPOT_ID, ...HERE, accuracyM: 10, ...body } });
  const guestCookieOf = (res: Response) => /guest=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")?.[1] ?? "";
  return { call, stamp, guestCookieOf, session1, mem };
}

describe("stamps without an account", () => {
  test("a visitor near the place gets a stamp kept in a signed cookie, with no certificate and nothing in the database", async () => {
    const { stamp, call, guestCookieOf } = await setup();
    const res = await stamp();
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    const body = (await res.json()) as Json;
    expect(body.stamp).toMatchObject({ spotId: SPOT_ID, alreadyStamped: false, finished: { routeIds: [], rallyIds: [] } });
    const cookie = `guest=${guestCookieOf(res)}`;
    const list = (await (await call("GET", "/guest/stamps", { cookie })).json()) as Json;
    expect(list.stamps).toMatchObject([{ spotId: SPOT_ID, routeId: ROUTE_ID }]);
    // Again: a no-op.
    expect(((await (await stamp(cookie)).json()) as Json).stamp.alreadyStamped).toBe(true);
  });

  test("the same place checks as an account's apply", async () => {
    const { stamp } = await setup();
    expect((await stamp(undefined, { lat: HERE.lat + 0.01 })).status).toBe(409);
    expect((await stamp(undefined, { accuracyM: 101 })).status).toBe(422);
  });

  test("a cookie made up by the browser holds no stamps", async () => {
    const { call } = await setup();
    const list = (await (await call("GET", "/guest/stamps", { cookie: "guest=AAAA.BBBB" })).json()) as Json;
    expect(list.stamps).toEqual([]);
  });

  test("signing up moves them to the account once; choosing the account's own drops them", async () => {
    const { stamp, call, guestCookieOf, session1 } = await setup();
    const cookie = `guest=${guestCookieOf(await stamp())}`;
    const claimed = (await (await call("POST", "/guest/claim", { cookie: `${session1}; ${cookie}`, body: { mode: "merge" } })).json()) as Json;
    expect(claimed).toMatchObject({ ok: true, added: 1, already: 0 });
    const mine = (await (await call("GET", "/stamps", { cookie: session1 })).json()) as Json;
    expect(mine.stamps).toHaveLength(1);

    const again = (await (await call("POST", "/guest/claim", { cookie: `${session1}; ${cookie}`, body: { mode: "merge" } })).json()) as Json;
    expect(again).toMatchObject({ added: 0, already: 1 });
    const dropped = await call("POST", "/guest/claim", { cookie: `${session1}; ${cookie}`, body: { mode: "account" } });
    expect(((await dropped.json()) as Json).added).toBe(0);
    expect(dropped.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  test("a backup code brings the stamps back in another browser, and a made-up code does nothing", async () => {
    const { stamp, call, guestCookieOf } = await setup();
    const cookie = `guest=${guestCookieOf(await stamp())}`;
    const code = ((await (await call("GET", "/guest/backup", { cookie })).json()) as Json).code as string;
    expect(code.length).toBeGreaterThan(10);
    expect(((await (await call("GET", "/guest/backup")).json()) as Json).code).toBe("");

    // A browser that holds nothing gets the stamp back.
    const back = await call("POST", "/guest/restore", { body: { code } });
    expect(((await back.json()) as Json)).toMatchObject({ ok: true, restored: 1, total: 1 });
    const list = (await (await call("GET", "/guest/stamps", { cookie: `guest=${guestCookieOf(back)}` })).json()) as Json;
    expect(list.stamps).toHaveLength(1);
    // The same code again adds nothing.
    expect(((await (await call("POST", "/guest/restore", { cookie, body: { code } })).json()) as Json).restored).toBe(0);
    expect((await call("POST", "/guest/restore", { body: { code: "AAAA.BBBB" } })).status).toBe(422);
  });

  test("claiming needs a login", async () => {
    const { call } = await setup();
    expect((await call("POST", "/guest/claim", { body: { mode: "merge" } })).status).toBe(401);
  });
});
