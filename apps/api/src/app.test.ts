import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import vercelEntry, { app } from "./app";
import { parseEnv } from "./parse-env";

describe("GET /api/v1/health", () => {
  test("returns ok", async () => {
    const res = await app.handle(new Request("http://localhost/api/v1/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("Vercel entry", () => {
  // Vercel's Elysia preset takes the first of these that exists; it must default-export the app.
  const candidates = ["app", "index", "server", "src/app", "src/index", "src/server"];
  const root = join(import.meta.dir, "..");
  const exists = (p: string) => {
    const dir = join(root, p, "..");
    const base = p.split("/").pop()!;
    try {
      return readdirSync(dir).some((f) => /^(.+)\.(js|cjs|mjs|ts|cts|mts)$/.exec(f)?.[1] === base);
    } catch {
      return false;
    }
  };

  test("the file Vercel picks is src/app.ts, and it default-exports the app", () => {
    expect(candidates.find(exists)).toBe("src/app");
    expect(vercelEntry).toBe(app);
  });
});

describe("parseEnv", () => {
  const ok = { DATABASE_URL: "postgres://u:p@localhost:5432/db" };

  test("applies defaults and converts PORT", () => {
    const env = parseEnv({ ...ok, PORT: "4000" });
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe("development");
    expect(env.APP_ORIGIN).toBe("http://localhost:3000");
  });

  test("production requires OTP_HMAC_SECRET", () => {
    expect(() => parseEnv({ NODE_ENV: "production", SMTP_HOST: "smtp.example.com" })).toThrow(/OTP_HMAC_SECRET/);
    expect(parseEnv({ NODE_ENV: "production", OTP_HMAC_SECRET: "k".repeat(32) }, () => {}).OTP_HMAC_SECRET).toHaveLength(32);
  });

  test("production without TRUST_PROXY starts, with a warning", () => {
    const logs: string[] = [];
    const prod = { NODE_ENV: "production", OTP_HMAC_SECRET: "k".repeat(32) };
    parseEnv(prod, (l) => logs.push(l));
    expect(logs.at(-1)).toMatch(/TRUST_PROXY is off/);
    parseEnv({ ...prod, TRUST_PROXY: "true" }, (l) => logs.push(l));
    expect(logs).toHaveLength(1);
  });

  test("boots with an empty environment", () => {
    expect(parseEnv({}).PORT).toBe(3001);
  });

  test("ADMIN_EMAILS must list real addresses", () => {
    expect(parseEnv({ ADMIN_EMAILS: "Owner@Example.com, b@example.org" }).ADMIN_EMAILS).toBe("Owner@Example.com, b@example.org");
    expect(parseEnv({ ADMIN_EMAILS: "" }).ADMIN_EMAILS).toBe("");
    expect(() => parseEnv({ ADMIN_EMAILS: "owner@example.com, owner" })).toThrow(/ADMIN_EMAILS: not an email address: owner/);
  });

  test("lists every problem at once", () => {
    expect(() => parseEnv({ PORT: "abc", NODE_ENV: "staging" })).toThrow(/NODE_ENV[\s\S]*PORT|PORT[\s\S]*NODE_ENV/);
  });

  test("rejects a non-postgres DATABASE_URL", () => {
    expect(() => parseEnv({ DATABASE_URL: "mysql://x" })).toThrow(/DATABASE_URL/);
  });

  test("falls back to the URL names Vercel's Postgres integrations set", () => {
    const vercel = "postgres://u:p@ep-x-pooler.neon.tech/db?sslmode=require";
    expect(parseEnv({ DB_POSTGRES_URL: vercel }).DATABASE_URL).toBe(vercel);
    expect(parseEnv({ POSTGRES_URL: vercel }).DATABASE_URL).toBe(vercel);
    // An explicit DATABASE_URL wins.
    expect(parseEnv({ ...ok, DB_POSTGRES_URL: vercel }).DATABASE_URL).toBe(ok.DATABASE_URL);
    expect(parseEnv({}).DATABASE_URL).toBeUndefined();
  });

  test("R2 photo storage: all five settings, else uploads are off and the API still starts", () => {
    const logs: string[] = [];
    const log = (line: string) => logs.push(line);
    const r2 = {
      R2_ACCOUNT_ID: "acc",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_BUCKET_NAME: "ktrg-photos",
      R2_PUBLIC_URL: "https://photos.example.com",
    };
    expect(parseEnv(r2).R2_BUCKET_NAME).toBe("ktrg-photos");
    expect(parseEnv({}).R2_BUCKET_NAME).toBeUndefined();
    expect(logs).toEqual([]);
    const { R2_PUBLIC_URL: _url, ...noUrl } = r2;
    const partial = parseEnv(noUrl, log);
    for (const k of Object.keys(r2)) expect(partial[k as keyof typeof r2]).toBeUndefined();
    expect(logs.at(-1)).toMatch(/OFF: missing R2_PUBLIC_URL/);
    expect(parseEnv({ ...r2, R2_PUBLIC_URL: "https://photos.example.com/" }, log).R2_BUCKET_NAME).toBeUndefined();
    expect(logs.at(-1)).toMatch(/invalid R2_PUBLIC_URL/);
    expect(parseEnv({ ...r2, R2_PUBLIC_URL: "http://photos.example.com" }, log).R2_BUCKET_NAME).toBeUndefined();
    expect(logs.join(" ")).not.toContain("secret");
    // Other problems still stop the start.
    expect(() => parseEnv({ ...noUrl, PORT: "abc" }, log)).toThrow(/PORT/);
  });
});
