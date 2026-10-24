import { describe, expect, test } from "bun:test";
import { AUTH_LIMITS, createRateLimiter } from "../auth/rate-limit";
import { createMemoryRateLimitStore } from "../auth/rate-limit-memory-store";
import { createRoutingService, parseSnapAnswer, withDailyCap, type RoutingService } from "./routing-service";

const POINTS = [
  { lat: 34.25, lng: 135.2 },
  { lat: 34.26, lng: 135.21 },
];

const answer = (coordinates: unknown, distance: unknown = 1234.4) => ({ features: [{ geometry: { coordinates }, properties: { summary: { distance } } }] });
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("withDailyCap", () => {
  const found = { ok: true as const, line: [[135.2, 34.25] as [number, number]], distanceM: 10 };

  test("calls go through until the day's cap, then the service looks unavailable, and the inner service is not called", async () => {
    let calls = 0;
    const inner: RoutingService = { snap: async () => (calls++, found) };
    const limiter = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "r".repeat(32), now: () => new Date("2026-10-21T00:00:00Z") });
    const capped = withDailyCap(inner, limiter);
    for (let i = 0; i < AUTH_LIMITS.routingDaily.limit; i++) expect((await capped.snap(POINTS)).ok).toBe(true);
    expect(await capped.snap(POINTS)).toEqual({ ok: false, reason: "routing_unavailable" });
    expect(calls).toBe(AUTH_LIMITS.routingDaily.limit);
  });

  test("when visitors' navigation has used its share, the admin's snap still gets the rest of the day", async () => {
    const inner: RoutingService = { snap: async () => found };
    const limiter = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "r".repeat(32), now: () => new Date("2026-10-21T00:00:00Z") });
    const admin = withDailyCap(inner, limiter);
    const visitors = withDailyCap(admin, limiter, AUTH_LIMITS.navigationAllDaily);
    for (let i = 0; i < AUTH_LIMITS.navigationAllDaily.limit; i++) expect((await visitors.snap(POINTS)).ok).toBe(true);
    expect(await visitors.snap(POINTS)).toEqual({ ok: false, reason: "routing_unavailable" });
    expect((await admin.snap(POINTS)).ok).toBe(true);
  });
});

describe("parseSnapAnswer", () => {
  test("reads a line with heights and the distance in metres", () => {
    expect(parseSnapAnswer(answer([[135.2, 34.25, 100], [135.21, 34.26, 120.5]]))).toEqual({
      ok: true,
      line: [[135.2, 34.25, 100], [135.21, 34.26, 120.5]],
      distanceM: 1234,
    });
  });

  test("positions are rounded to 6 decimals and heights to one, so the map editor accepts them", () => {
    const r = parseSnapAnswer(answer([[135.123456789, 34.987654321, 100.449], [135.2, 34.3]]));
    expect(r.ok && r.line[0]).toEqual([135.123457, 34.987654, 100.4]);
  });

  test("a point without a height stays without one", () => {
    const r = parseSnapAnswer(answer([[135.2, 34.25], [135.21, 34.26]]));
    expect(r.ok && r.line[0]).toEqual([135.2, 34.25]);
  });

  test("anything that is not a line of valid points is a failure", () => {
    for (const bad of [null, {}, { features: [] }, answer([[135.2, 34.25]]), answer("x"), answer([[135.2, "a"], [1, 2]]), answer([[135.2, Number.NaN], [1, 2]])]) {
      expect(parseSnapAnswer(bad)).toEqual({ ok: false, reason: "routing_failed" });
    }
  });
});

describe("the routing service", () => {
  test("without a key it is unavailable and asks nobody", async () => {
    let asked = false;
    const svc = createRoutingService({ fetchImpl: (() => ((asked = true), json({}))) as unknown as typeof fetch });
    expect(await svc.snap(POINTS)).toEqual({ ok: false, reason: "routing_unavailable" });
    expect(asked).toBe(false);
  });

  test("asks for a walking route in longitude, latitude order with the key in the header", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const svc = createRoutingService({
      apiKey: "secret-key",
      fetchImpl: ((url: string, init: RequestInit) => {
        seen = { url, init };
        return json(answer([[135.2, 34.25, 10], [135.21, 34.26, 20]]));
      }) as unknown as typeof fetch,
    });
    const r = await svc.snap(POINTS);
    expect(r.ok).toBe(true);
    expect(seen?.url).toContain("/directions/foot-hiking/geojson");
    expect((seen?.init.headers as Record<string, string>).Authorization).toBe("secret-key");
    const body = JSON.parse(String(seen?.init.body)) as { coordinates: number[][]; elevation: boolean };
    expect(body.coordinates).toEqual([[135.2, 34.25], [135.21, 34.26]]);
    expect(body.elevation).toBe(true);
  });

  test("each way it can go wrong has its own answer", async () => {
    const with_ = (status: number) => createRoutingService({ apiKey: "k", fetchImpl: (() => json({}, status)) as unknown as typeof fetch });
    expect(await with_(401).snap(POINTS)).toEqual({ ok: false, reason: "routing_unavailable" });
    expect(await with_(403).snap(POINTS)).toEqual({ ok: false, reason: "routing_unavailable" });
    expect(await with_(429).snap(POINTS)).toEqual({ ok: false, reason: "routing_unavailable" });
    expect(await with_(404).snap(POINTS)).toEqual({ ok: false, reason: "routing_no_route" });
    expect(await with_(500).snap(POINTS)).toEqual({ ok: false, reason: "routing_failed" });
    const down = createRoutingService({ apiKey: "k", fetchImpl: (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch });
    expect(await down.snap(POINTS)).toEqual({ ok: false, reason: "routing_failed" });
  });

  test("a service that never answers is given up on", async () => {
    const hang = ((_: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as unknown as typeof fetch;
    const svc = createRoutingService({ apiKey: "k", fetchImpl: hang, timeoutMs: 20 });
    expect(await svc.snap(POINTS)).toEqual({ ok: false, reason: "routing_failed" });
  });
});
