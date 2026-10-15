import { describe, expect, test } from "bun:test";
import { Elysia, t } from "elysia";
import { createApp } from "../app";
import { fail } from "../auth/http";
import { ERROR_CODES, apiBase, requestIdFrom } from "./api-errors";

function setup() {
  const logs: string[] = [];
  const app = new Elysia({ prefix: "/api/v1" })
    .use(apiBase({ log: (line) => logs.push(line) }))
    .get("/ok", () => ({ ok: true as const }))
    .get("/conflict", ({ set }) => fail(set, 409, "no_email"))
    .get("/denied", ({ status }) => status(401, { ok: false as const, error: "unauthenticated" as const }))
    .get("/boom", () => {
      throw new Error("db at 10.0.0.5 refused user secret-db-user");
    })
    .get("/bad-response", () => ({ count: "many" }) as unknown as { count: number }, {
      response: t.Object({ count: t.Number() }),
    })
    .post("/things/:id", ({ body }) => ({ ok: true as const, body }), {
      params: t.Object({ id: t.String({ pattern: "^[0-9]+$" }) }),
      body: t.Object({ email: t.String({ format: "email" }), code: t.String({ pattern: "^[0-9]{6}$" }) }),
    });

  const call = (method: string, path: string, init: { body?: string; headers?: Record<string, string> } = {}) =>
    app.handle(
      new Request(`http://localhost/api/v1${path}`, {
        method,
        headers: { ...(init.body === undefined ? {} : { "content-type": "application/json" }), ...init.headers },
        body: init.body,
      }),
    );
  return { call, logs };
}

describe("request ids", () => {
  test("every answer carries a new x-request-id: success, a route's own error, a guard's 401", async () => {
    const { call } = setup();
    const ids = [];
    for (const path of ["/ok", "/ok", "/conflict", "/denied", "/nope"]) {
      const id = (await call("GET", path)).headers.get("x-request-id");
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      ids.push(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("a caller's id is kept when it looks like one, so a proxy's logs and ours line up", async () => {
    const { call } = setup();
    const res = await call("GET", "/ok", { headers: { "x-request-id": "edge:hnd1::abc-123.XYZ" } });
    expect(res.headers.get("x-request-id")).toBe("edge:hnd1::abc-123.XYZ");
  });

  test("anything else is replaced, so a log line cannot be forged or flooded through it", () => {
    for (const bad of ["short", "x".repeat(129), "abc def ghi", "id\n[api] 500 fake", "<script>alert(1)</script>"]) {
      expect(requestIdFrom(bad)).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(requestIdFrom(null)).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("one error shape", () => {
  test("routes' own errors pass through untouched", async () => {
    const { call } = setup();
    const res = await call("GET", "/conflict");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "no_email" });
  });

  test("an unknown route or method is a JSON 404 not_found", async () => {
    const { call } = setup();
    for (const [method, path] of [
      ["GET", "/nope"],
      ["DELETE", "/ok"],
    ] as const) {
      const res = await call(method, path);
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toStartWith("application/json");
      expect(await res.json()).toEqual({ ok: false, error: "not_found" });
    }
  });

  test("a body that is not JSON is 400 bad_request", async () => {
    const { call } = setup();
    const res = await call("POST", "/things/1", { body: "{not json" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "bad_request" });
  });

  test("a schema mismatch is 422 validation_failed with where and what, never the value sent", async () => {
    const { call } = setup();
    const res = await call("POST", "/things/1", { body: JSON.stringify({ email: "walker-at-example", code: "12" }) });
    expect(res.status).toBe(422);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({
      ok: false,
      error: "validation_failed",
      issues: [
        { in: "body", path: "/email", message: "Expected string to match 'email' format" },
        { in: "body", path: "/code", message: "Expected string to match '^[0-9]{6}$'" },
      ],
    });
    expect(text).not.toContain("walker-at-example");
  });

  test("a missing field and a bad URL parameter say where they are", async () => {
    const { call } = setup();
    const missing = await call("POST", "/things/1", { body: JSON.stringify({ email: "a@example.com" }) });
    expect(((await missing.json()) as { issues: unknown[] }).issues).toEqual([
      { in: "body", path: "/code", message: "Expected string" },
    ]);

    const param = await call("POST", "/things/abc", { body: JSON.stringify({ email: "a@example.com", code: "123456" }) });
    expect(param.status).toBe(422);
    expect(((await param.json()) as { issues: { in: string; path: string }[] }).issues[0]).toMatchObject({
      in: "params",
      path: "/id",
    });
  });

  test("anything thrown is a bare 500 internal_error; the details go to the log with the request id", async () => {
    const { call, logs } = setup();
    const res = await call("GET", "/boom?token=abc123");
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false, error: "internal_error" });
    expect(text).not.toContain("secret-db-user");

    expect(logs).toHaveLength(1);
    expect(logs[0]).toStartWith(`[api] 500 ${res.headers.get("x-request-id")} GET /api/v1/boom: Error: db at 10.0.0.5`);
    expect(logs[0]).not.toContain("abc123"); // no query string
  });

  test("an answer that breaks its own response schema is our bug: 500, not 422", async () => {
    const { call, logs } = setup();
    const res = await call("GET", "/bad-response");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "internal_error" });
    expect(logs).toHaveLength(1);
  });
});

describe("the real app", () => {
  // No services are needed for these: they fail before any route runs.
  const app = createApp(
    () => {
      throw new Error("services are not used here");
    },
    { secureCookies: false, docs: false },
  );

  test("uses the base: unknown routes and bad bodies get the shared shape and a request id", async () => {
    const notFound = await app.handle(new Request("http://localhost/api/v1/nope"));
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toEqual({ ok: false, error: "not_found" });
    expect(notFound.headers.get("x-request-id")).toBeTruthy();

    const bad = await app.handle(
      new Request("http://localhost/api/v1/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "nope" }),
      }),
    );
    expect(bad.status).toBe(422);
    expect(((await bad.json()) as { error: string }).error).toBe("validation_failed");
  });

  test("every error code is in snake_case and says its status", () => {
    for (const [code, meaning] of Object.entries(ERROR_CODES)) {
      expect(code).toMatch(/^[a-z]+(_[a-z]+)*$/);
      expect(meaning).toMatch(/^\d{3}/);
    }
  });
});
