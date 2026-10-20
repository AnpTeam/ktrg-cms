import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createRateLimiter } from "../auth/rate-limit";
import { createMemoryRateLimitStore } from "../auth/rate-limit-memory-store";
import { createMemorySessionStore } from "../auth/session-memory-store";
import { createSessionService } from "../auth/session-service";
import type { AuthUser } from "../auth/user";
import { apiBase } from "../lib/api-errors";
import type { LatLng, RoutingService, SnapResult } from "../routing/routing-service";
import { createMemoryStampStore } from "../stamps/stamp-memory-store";
import { createStampService } from "../stamps/stamp-service";
import type { StampSpot } from "../stamps/stamp-types";
import { navigationRoutes } from "./navigation-routes";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- test answers

const alice: AuthUser = { id: "22222222-2222-4222-8222-222222222222", email: "alice@example.com", role: "participant", locale: "ja" };
const SPOT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLACE = { lat: 34.3, lng: 135.1 };
const spot = (over: Partial<StampSpot> = {}): StampSpot => ({
  id: SPOT_ID, routeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", published: true, stampable: true, positionVerified: true, ...PLACE, radiusM: 50, status: "open", ...over,
});

async function setup(answer: SnapResult = { ok: true, line: [[135.09, 34.31], [135.1, 34.3]], distanceM: 1400 }) {
  const users = new Map<string, AuthUser>([[alice.id, { ...alice }]]);
  const session = createSessionService({ store: createMemorySessionStore(users).store });
  const audit = createMemoryAuditWriter();
  const mem = createMemoryStampStore(audit.writer);
  mem.spots.set(SPOT_ID, spot());
  const asked: (readonly LatLng[])[] = [];
  const routing: RoutingService = {
    snap: async (points) => {
      asked.push(points);
      return answer;
    },
  };
  const services = {
    session,
    rateLimit: createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "m".repeat(32) }),
    audit: audit.writer,
    stamps: createStampService({ store: mem.store }),
    routing,
  };
  const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(navigationRoutes(() => services, { secureCookies: false }));
  const cookie = `session=${(await session.create(users.get(alice.id)!)).token}`;
  const ask = (body: Json, withCookie = true) =>
    app.handle(
      new Request("http://localhost/api/v1/navigation/path", {
        method: "POST",
        headers: { "content-type": "application/json", ...(withCookie ? { cookie } : {}) },
        body: JSON.stringify(body),
      }),
    );
  const here = { spotId: SPOT_ID, lat: 34.31, lng: 135.09 };
  return { ask, here, asked, mem };
}

describe("POST /navigation/path", () => {
  test("a signed-in visitor gets the walking path from where they are to the stamp place", async () => {
    const { ask, here, asked } = await setup();
    const res = await ask(here);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, line: [[135.09, 34.31], [135.1, 34.3]], distanceM: 1400 });
    // The destination is the place's own position, not anything the caller sent.
    expect(asked).toEqual([[{ lat: 34.31, lng: 135.09 }, PLACE]]);
  });

  test("signed out: 401, and the routing service is never called", async () => {
    const { ask, here, asked } = await setup();
    expect((await ask(here, false)).status).toBe(401);
    expect(asked).toHaveLength(0);
  });

  test("a draft, a non-stamp place or one without a checked position looks missing", async () => {
    const { ask, here, mem, asked } = await setup();
    for (const over of [{ published: false }, { stampable: false }, { positionVerified: false }, { lat: null, lng: null }]) {
      mem.spots.set(SPOT_ID, spot(over));
      const res = await ask(here);
      expect([res.status, ((await res.json()) as Json).error]).toEqual([404, "not_found"]);
    }
    expect((await ask({ ...here, spotId: crypto.randomUUID() })).status).toBe(404);
    expect(asked).toHaveLength(0);
  });

  test("the routing service's failures keep their codes", async () => {
    for (const [reason, status] of [["routing_unavailable", 503], ["routing_no_route", 422], ["routing_failed", 502]] as const) {
      const { ask, here } = await setup({ ok: false, reason });
      const res = await ask(here);
      expect([res.status, ((await res.json()) as Json).error]).toEqual([status, reason]);
    }
  });

  test("bad input is 422; too many asks is 429", async () => {
    const { ask, here } = await setup();
    expect((await ask({ ...here, lat: 91 })).status).toBe(422);
    expect((await ask({ ...here, spotId: "nope" })).status).toBe(422);
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await ask(here)).status;
    expect(last).toBe(429);
  });
});
