import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createRateLimiter } from "../auth/rate-limit";
import { createMemoryRateLimitStore } from "../auth/rate-limit-memory-store";
import { createMemorySessionStore } from "../auth/session-memory-store";
import { createSessionService } from "../auth/session-service";
import type { AuthUser } from "../auth/user";
import { apiBase } from "../lib/api-errors";
import { listMetaRoutes } from "./list-routes";
import { ADMIN_LISTS } from "./lists";

const BILINGUAL = new Set(["bilingual", "bilingual-long"]);

describe("every admin list describes its screens completely", () => {
  for (const def of ADMIN_LISTS) {
    test(`${def.key}: the form sends exactly the API's writable fields, and the list is named by a shown field`, () => {
      const sent = def.ui.fields.filter((f) => !f.readOnly).flatMap((f) => (BILINGUAL.has(f.kind) ? [`${f.name}Ja`, `${f.name}En`] : [f.name]));
      // Create needs every field, so the form must offer each one, and nothing the API would refuse.
      expect(sent.sort()).toEqual(Object.keys("fields" in def ? def.fields : {}).sort());
      expect(new Set(def.ui.fields.map((f) => f.name)).size).toBe(def.ui.fields.length);
      // Only a list with something to send can be created or changed.
      if (sent.length === 0) expect(def.ops.create || def.ops.edit).toBe(false);
      if (def.ops.create) expect(def.ui.newLabel?.ja).toBeTruthy();
      if (def.ops.delete) expect(def.ui.deleteWarning?.ja).toBeTruthy();
      const title = def.ui.fields.find((f) => f.name === def.ui.titleField);
      expect(title && (BILINGUAL.has(title.kind) || title.kind === "text")).toBe(true);
      for (const f of def.ui.fields) if (f.kind === "select") expect((f.options ?? []).length).toBeGreaterThan(0);
      for (const f of def.ui.fields) {
        expect(f.label.ja.trim().length > 0 && f.label.en.trim().length > 0).toBe(true);
      }
    });
  }
});

describe("GET /admin/lists", () => {
  const admin: AuthUser = { id: "11111111-1111-4111-8111-111111111111", email: "admin@example.com", role: "admin", locale: "ja" };
  const alice: AuthUser = { id: "22222222-2222-4222-8222-222222222222", email: "alice@example.com", role: "participant", locale: "ja" };
  const users = new Map<string, AuthUser>([[admin.id, admin], [alice.id, alice]]);
  const session = createSessionService({ store: createMemorySessionStore(users).store });
  const services = {
    session,
    rateLimit: createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "m".repeat(32) }),
    audit: createMemoryAuditWriter().writer,
  };
  const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(listMetaRoutes(ADMIN_LISTS, () => services, { secureCookies: false }));
  const get = async (u?: AuthUser) => {
    const cookie = u ? `session=${(await session.create(u)).token}` : undefined;
    const res = await app.handle(new Request("http://localhost/api/v1/admin/lists", { headers: cookie ? { cookie } : {} }));
    return { status: res.status, body: (await res.json()) as { ok: boolean; lists?: Record<string, unknown>[] } };
  };

  test("signed out: 401; a participant: no lists; an admin: every list, without permissions or schemas", async () => {
    expect((await get()).status).toBe(401);
    expect((await get(alice)).body).toEqual({ ok: true, lists: [] });
    const lists = (await get(admin)).body.lists!;
    expect(lists.map((l) => l.key)).toEqual(ADMIN_LISTS.map((d) => d.key));
    for (const l of lists) {
      expect(Object.keys(l).filter((k) => !["deleteWarning", "fields", "intro", "key", "newLabel", "ops", "title", "titleField", "linkTo"].includes(k))).toEqual([]);
    }
  });
});
