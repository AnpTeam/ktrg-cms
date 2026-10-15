import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { app } from "./app";
import { apiDocs } from "./openapi";

type Operation = { tags?: string[]; security?: unknown[]; description?: string };
type Doc = { openapi: string; info: { title: string }; paths: Record<string, Record<string, Operation>> };

async function doc(): Promise<Doc> {
  const res = await app.handle(new Request("http://localhost/api/v1/openapi/json"));
  expect(res.status).toBe(200);
  return (await res.json()) as Doc;
}
const op = (d: Doc, path: string, method: string) => d.paths[`/api/v1${path}`]?.[method];

describe("API docs (outside production)", () => {
  test("the interactive page and the OpenAPI JSON are served", async () => {
    const page = await app.handle(new Request("http://localhost/api/v1/openapi"));
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    const d = await doc();
    expect(d.openapi).toMatch(/^3\./);
    expect(d.info.title).toBe("KTRG API");
  });

  test("every endpoint is listed, under its tag", async () => {
    const d = await doc();
    const expected: [string, string, string][] = [
      ["/health", "get", "Health"],
      ["/auth/otp/request", "post", "Auth"],
      ["/auth/otp/verify", "post", "Auth"],
      ["/auth/session", "get", "Auth"],
      ["/auth/logout", "post", "Auth"],
      ["/auth/reauth/request", "post", "Auth"],
      ["/auth/reauth/verify", "post", "Auth"],
      ["/auth/passkeys/", "get", "Passkeys"],
      ["/auth/passkeys/{id}", "delete", "Passkeys"],
      ["/auth/passkeys/register/options", "post", "Passkeys"],
      ["/auth/passkeys/register/verify", "post", "Passkeys"],
      ["/auth/passkeys/signup/options", "post", "Passkeys"],
      ["/auth/passkeys/signup/verify", "post", "Passkeys"],
      ["/auth/passkeys/login/options", "post", "Passkeys"],
      ["/auth/passkeys/login/verify", "post", "Passkeys"],
      ["/me/", "get", "Me"],
      ["/me/", "patch", "Me"],
      ["/me/", "delete", "Me"],
      ["/me/deletion/cancel", "post", "Me"],
    ];
    for (const [path, method, tag] of expected) {
      expect(op(d, path, method)?.tags, `${method} ${path}`).toEqual([tag]);
    }
  });

  test("routes that need a login say so (session cookie); public ones do not", async () => {
    const d = await doc();
    for (const [path, method] of [
      ["/auth/session", "get"],
      ["/auth/reauth/request", "post"],
      ["/auth/passkeys/", "get"],
      ["/auth/passkeys/register/options", "post"],
      ["/me/", "patch"],
      ["/me/", "delete"],
    ]) {
      expect(op(d, path!, method!)?.security, `${method} ${path}`).toEqual([{ session: [] }]);
    }
    for (const [path, method] of [
      ["/health", "get"],
      ["/auth/otp/request", "post"],
      ["/auth/otp/verify", "post"],
      ["/auth/passkeys/login/options", "post"],
    ]) {
      expect(op(d, path!, method!)?.security, `${method} ${path}`).toBeUndefined();
    }
  });

  test("a guarded route names the permission it needs", async () => {
    expect(op(await doc(), "/me/", "get")?.description).toContain("`me.manage`");
  });
});

describe("API docs switched off (production default)", () => {
  test("neither the page nor the JSON exists", async () => {
    const off = new Elysia({ prefix: "/api/v1" }).use(apiDocs({ enabled: false })).get("/health", () => "ok");
    expect((await off.handle(new Request("http://localhost/api/v1/openapi"))).status).toBe(404);
    expect((await off.handle(new Request("http://localhost/api/v1/openapi/json"))).status).toBe(404);
    expect((await off.handle(new Request("http://localhost/api/v1/health"))).status).toBe(200);
  });
});
