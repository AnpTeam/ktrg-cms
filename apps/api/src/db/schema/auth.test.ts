import { describe, expect, test } from "bun:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { otpCodes, passkeys, sessions, users, webauthnChallenges } from "./auth";

const columns = (t: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(t).columns.map((c) => c.name);

describe("auth schema", () => {
  test("table names", () => {
    expect([users, sessions, passkeys, otpCodes, webauthnChallenges].map((t) => getTableConfig(t).name)).toEqual([
      "users",
      "sessions",
      "passkeys",
      "otp_codes",
      "webauthn_challenges",
    ]);
  });

  test("sessions store a token hash, never the token", () => {
    expect(columns(sessions)).toContain("token_hash");
    expect(columns(sessions)).not.toContain("token");
  });

  test("otp codes store a hash, never the code", () => {
    expect(columns(otpCodes)).toContain("code_hash");
    expect(columns(otpCodes)).not.toContain("code");
  });

  test("user-owned rows are deleted with the user", () => {
    for (const t of [sessions, passkeys, webauthnChallenges]) {
      const fk = getTableConfig(t).foreignKeys[0]!.reference();
      expect(fk.foreignTable).toBe(users);
      expect(getTableConfig(t).foreignKeys[0]!.onDelete).toBe("cascade");
    }
  });

  test("webauthn challenge user is optional (discoverable login)", () => {
    const col = getTableConfig(webauthnChallenges).columns.find((c) => c.name === "user_id")!;
    expect(col.notNull).toBe(false);
  });
});
