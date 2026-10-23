import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { listReadRoutes, listWriteRoutes } from "../admin-lists/list-routes";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createRateLimiter } from "../auth/rate-limit";
import { createMemoryRateLimitStore } from "../auth/rate-limit-memory-store";
import { createMemorySessionStore } from "../auth/session-memory-store";
import { createSessionService } from "../auth/session-service";
import type { AuthUser } from "../auth/user";
import { apiBase } from "../lib/api-errors";
import { createMemoryPlaceStore, createPlaceService, placeDirectoryList } from "./place-directory";

const admin: AuthUser = { id: "11111111-1111-4111-8111-111111111111", email: "admin@example.com", role: "admin", locale: "ja" };

describe("changing one field of a place", () => {
  test("only that field changes: the category and the status are not reset to a first choice", async () => {
    const users = new Map<string, AuthUser>([[admin.id, { ...admin }]]);
    const session = createSessionService({ store: createMemorySessionStore(users).store });
    const audit = createMemoryAuditWriter();
    const places = createPlaceService({ store: createMemoryPlaceStore(audit.writer).store });
    const rateLimit = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "m".repeat(32) });
    const services = { session, rateLimit, audit: audit.writer, places };
    const opts = { secureCookies: false };
    const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(listReadRoutes(placeDirectoryList, () => services, opts)).use(listWriteRoutes(placeDirectoryList, () => services, opts));
    const cookie = `session=${(await session.create(users.get(admin.id)!)).token}`;
    const call = async (method: string, path: string, body?: unknown) => {
      const res = await app.handle(new Request(`http://localhost/api/v1${path}`, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) }));
      return { status: res.status, body: (await res.json()) as Record<string, any> }; // eslint-disable-line -- test helper
    };
    const made = await call("POST", "/admin/lists/directory", {
      category: "parking", routeId: null, nameJa: "加太港駐車場", nameEn: null, descriptionJa: null, descriptionEn: null, hoursJa: null, hoursEn: null, closedDaysJa: null, closedDaysEn: null,
      lat: 34.27, lng: 135.07, positionVerified: false, positionSource: null, address: null, phone: null, website: null, photoUrl: null, status: "seasonal", lastVerified: null, listingConfirmed: false, listingNote: null, published: false,
    });
    expect(made.status).toBe(201);
    const item = made.body.item;
    const changed = await call("PATCH", `/admin/lists/directory/${item.id}`, { updatedAt: item.updatedAt, nameJa: "新しい名前" });
    expect(changed.status).toBe(200);
    expect(changed.body.item).toMatchObject({ nameJa: "新しい名前", category: "parking", status: "seasonal" });
  });
});

describe("the public places answer", () => {
  test("more than the limit are cut, and the cut is logged once", async () => {
    const { MAX_PUBLIC_PLACES, publicPlaceRoutes } = await import("./place-directory");
    const rows = Array.from({ length: MAX_PUBLIC_PLACES + 5 }, (_, i) => ({ id: crypto.randomUUID(), category: "toilet", routeId: null, nameJa: `p${i}`, nameEn: null, descriptionJa: null, descriptionEn: null, hoursJa: null, hoursEn: null, closedDaysJa: null, closedDaysEn: null, lat: 34, lng: 135, address: null, phone: null, website: null, photoUrl: null, photoCredit: null, status: "open", lastVerified: null }));
    const logs: string[] = [];
    const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(publicPlaceRoutes(() => ({ publicPlaces: async () => rows }) as never, (m) => logs.push(m)));
    for (let i = 0; i < 2; i++) {
      const body = (await (await app.handle(new Request("http://localhost/api/v1/places"))).json()) as { places: unknown[] };
      expect(body.places).toHaveLength(MAX_PUBLIC_PLACES);
    }
    expect(logs).toHaveLength(1);
  });
});
