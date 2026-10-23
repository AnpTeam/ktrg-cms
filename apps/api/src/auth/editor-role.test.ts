import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { listReadRoutes } from "../admin-lists/list-routes";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { auditLogList } from "../audit/audit-list";
import { noticeList } from "../notices/notice-routes";
import { stampList } from "../stamps/stamp-list";
import { userList } from "../users/user-list";
import { apiBase } from "../lib/api-errors";
import { createRateLimiter } from "./rate-limit";
import { createMemoryRateLimitStore } from "./rate-limit-memory-store";
import { createMemorySessionStore } from "./session-memory-store";
import { createSessionService } from "./session-service";
import type { AuthUser } from "./user";

// The real list definitions, mounted with an empty service behind each: the guard in front of every list runs for real,
// so these say who may open which admin list.
const admin: AuthUser = { id: "11111111-1111-4111-8111-111111111111", email: "admin@example.com", role: "admin", locale: "ja" };
const editor: AuthUser = { id: "33333333-3333-4333-8333-333333333333", email: "editor@example.com", role: "editor", locale: "ja" };
const alice: AuthUser = { id: "22222222-2222-4222-8222-222222222222", email: "alice@example.com", role: "participant", locale: "ja" };

const empty = { list: async () => ({ items: [], next: null }), get: async () => null };
const users = new Map<string, AuthUser>([[admin.id, admin], [editor.id, editor], [alice.id, alice]]);
const session = createSessionService({ store: createMemorySessionStore(users).store });
const services = {
  session,
  rateLimit: createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "m".repeat(32) }),
  audit: createMemoryAuditWriter().writer,
  userList: empty,
  auditList: empty,
  stampList: empty,
  noticeList: empty,
};
// shortcut: the notice list's real service is a read-write one, so its stub is cast; only the guard is under test.
const asServices = services as never;
const app = new Elysia({ prefix: "/api/v1" })
  .use(apiBase())
  .use(listReadRoutes(userList, () => asServices, { secureCookies: false }))
  .use(listReadRoutes(auditLogList, () => asServices, { secureCookies: false }))
  .use(listReadRoutes(stampList, () => asServices, { secureCookies: false }))
  .use(listReadRoutes({ ...noticeList, service: () => empty as never } as never, () => asServices, { secureCookies: false }));

const status = async (path: string, u?: AuthUser) => {
  const cookie = u ? `session=${(await session.create(u)).token}` : undefined;
  return (await app.handle(new Request(`http://localhost/api/v1/admin/lists/${path}`, { headers: cookie ? { cookie } : {} }))).status;
};

describe("who may open which admin list", () => {
  test("an editor is refused the accounts, the history and the stamps (403), and may open the content lists", async () => {
    for (const list of ["users", "audit", "stamps"]) expect(await status(list, editor)).toBe(403);
    expect(await status("notices", editor)).toBe(200);
  });
  test("an admin may open all of them; a participant none; signed out gets 401", async () => {
    for (const list of ["users", "audit", "stamps", "notices"]) {
      expect(await status(list, admin)).toBe(200);
      expect(await status(list, alice)).toBe(403);
      expect(await status(list)).toBe(401);
    }
  });
});
