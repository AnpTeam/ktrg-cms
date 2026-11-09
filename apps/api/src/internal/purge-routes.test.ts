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

describe("POST /internal/furigana-refresh", () => {
  const hit = (cronSecret: string | undefined, authorization?: string) => {
    let calls = 0;
    const app = new Elysia({ prefix: "/api/v1" }).use(
      purgeRoutes(() => ({ me: { purgeDue: async () => 0 }, furigana: { refresh: async () => (calls++, { added: 3, removed: 1 }) } }) as never, cronSecret),
    );
    const res = app.handle(new Request("http://localhost/api/v1/internal/furigana-refresh", { method: "POST", headers: authorization ? { authorization } : {} }));
    return { res, calls: () => calls };
  };

  test("the right secret has the dictionary read the site and returns only counts", async () => {
    const { res, calls } = hit(secret, `Bearer ${secret}`);
    const r = await res;
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, added: 3, removed: 1 });
    expect(calls()).toBe(1);
  });

  test("a wrong secret is refused and nothing runs; with no secret set up the route does not exist", async () => {
    const wrong = hit(secret, "Bearer wrong");
    expect((await wrong.res).status).toBe(401);
    expect(wrong.calls()).toBe(0);
    const none = hit(undefined, `Bearer ${secret}`);
    expect((await none.res).status).toBe(404);
    expect(none.calls()).toBe(0);
  });
});
