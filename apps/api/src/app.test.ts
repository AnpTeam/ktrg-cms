import { describe, expect, test } from "bun:test";
import { app } from "./app";
import { parseEnv } from "./parse-env";

describe("GET /api/v1/health", () => {
  test("returns ok", async () => {
    const res = await app.handle(new Request("http://localhost/api/v1/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
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
    expect(parseEnv({ NODE_ENV: "production", OTP_HMAC_SECRET: "k".repeat(32) }).OTP_HMAC_SECRET).toHaveLength(32);
  });

  test("boots with an empty environment", () => {
    expect(parseEnv({}).PORT).toBe(3001);
  });

  test("lists every problem at once", () => {
    expect(() => parseEnv({ PORT: "abc", NODE_ENV: "staging" })).toThrow(/NODE_ENV[\s\S]*PORT|PORT[\s\S]*NODE_ENV/);
  });

  test("rejects a non-postgres DATABASE_URL", () => {
    expect(() => parseEnv({ DATABASE_URL: "mysql://x" })).toThrow(/DATABASE_URL/);
  });
});
