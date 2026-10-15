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

  test("a user's email is optional: an account can be made with a passkey alone", () => {
    const col = getTableConfig(users).columns.find((c) => c.name === "email")!;
    expect(col.notNull).toBe(false);
  });

  test("email is still unique ignoring case when present", () => {
    const idx = getTableConfig(users).indexes.find((i) => i.config.name === "users_email_lower_uq")!;
    expect(idx.config.unique).toBe(true);
  });

  test("passkey sign-up reserves the new account id without a foreign key", () => {
    const col = getTableConfig(webauthnChallenges).columns.find((c) => c.name === "pending_user_id")!;
    expect(col.notNull).toBe(false);
    expect(getTableConfig(webauthnChallenges).foreignKeys).toHaveLength(1); // only user_id
  });
});
