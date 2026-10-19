import { describe, expect, test } from "bun:test";
import { connectionFor } from "./client";

describe("connectionFor", () => {
  test("a direct or session connection keeps prepared statements and the URL", () => {
    const local = "postgres://ktrg:pw@localhost:5432/ktrg";
    expect(connectionFor(local)).toEqual({ url: local, prepare: true });
    const session = "postgres://u:pw@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require";
    expect(connectionFor(session)).toEqual({ url: session, prepare: true });
  });

  test("Supabase's transaction pooler (Vercel's DB_POSTGRES_URL): no prepared statements, no supa=", () => {
    const vercel = "postgres://u:pw@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x";
    expect(connectionFor(vercel)).toEqual({
      url: "postgres://u:pw@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
      prepare: false,
    });
  });

  test("pgbouncer=true means a transaction pooler on any port, and is not sent to the server", () => {
    const { url, prepare } = connectionFor("postgres://u:pw@pooler.example.com:5432/db?sslmode=require&pgbouncer=true");
    expect(prepare).toBe(false);
    expect(new URL(url).searchParams.has("pgbouncer")).toBe(false);
    expect(new URL(url).searchParams.get("sslmode")).toBe("require");
  });
});
