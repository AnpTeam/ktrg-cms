import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { purgeRoutes } from "./purge-routes";

const secret = "s".repeat(40);

function call(cronSecret: string | undefined, authorization?: string, purged = 2) {
  let calls = 0;
  const app = new Elysia({ prefix: "/api/v1" }).use(
    purgeRoutes(
      () => ({ me: { purgeDue: async () => (calls++, purged) } }) as never,
      cronSecret,
    ),
  );
  const res = app.handle(
    new Request("http://localhost/api/v1/internal/purge-deletions", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    }),
  );
  return { res, calls: () => calls };
}

describe("POST /internal/purge-deletions", () => {
  test("the right secret runs the purge and returns only a count", async () => {
    const { res, calls } = call(secret, `Bearer ${secret}`);
    const r = await res;
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, deleted: 2 });
    expect(calls()).toBe(1);
  });

  test("no header or a wrong secret is refused (401) and purges nothing", async () => {
    for (const header of [undefined, "Bearer wrong", `Basic ${secret}`, "Bearer "]) {
      const { res, calls } = call(secret, header);
      expect((await res).status).toBe(401);
      expect(calls()).toBe(0);
    }
  });

  test("with no secret configured the route does not exist (404)", async () => {
    const { res, calls } = call(undefined, `Bearer ${secret}`);
    expect((await res).status).toBe(404);
    expect(calls()).toBe(0);
  });
});
