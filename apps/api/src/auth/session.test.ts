import { describe, expect, test } from "bun:test";
import {
  SESSION_POLICY,
  clearSessionCookie,
  generateSessionToken,
  hashSessionToken,
  readCookie,
  serializeSessionCookie,
  sessionCookieName,
} from "./session";

describe("session token", () => {
  test("is long, URL-safe and different every time", () => {
    const tokens = new Set(Array.from({ length: 20 }, generateSessionToken));
    expect(tokens.size).toBe(20);
    for (const t of tokens) expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test("hash is SHA-256 hex and hides the token", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashSessionToken(token)).toBe(hash);
  });

  test("the known SHA-256 vector matches", () => {
    expect(hashSessionToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("session policy", () => {
  const DAY = 24 * 3600 * 1000;

  test("participant is about a year", () => {
    expect(SESSION_POLICY.participant.idleMs).toBe(365 * DAY);
    expect(SESSION_POLICY.participant.absoluteMs).toBe(365 * DAY);
  });

  test("admin is 14 days idle and 30 days absolute", () => {
    expect(SESSION_POLICY.admin.idleMs).toBe(14 * DAY);
    expect(SESSION_POLICY.admin.absoluteMs).toBe(30 * DAY);
  });
});

describe("cookies", () => {
  test("only the secure (production) name uses the __Host- prefix", () => {
    expect(sessionCookieName(true)).toBe("__Host-session");
    expect(sessionCookieName(false)).toBe("session");
  });

  test("serialize: persistent, HttpOnly, SameSite=Lax; Secure only when asked", () => {
    const plain = serializeSessionCookie({ name: "session", value: "v", maxAgeSec: 100.9, secure: false });
    expect(plain).toBe("session=v; Path=/; HttpOnly; SameSite=Lax; Max-Age=100");
    const secure = serializeSessionCookie({ name: "__Host-session", value: "v", maxAgeSec: 5, secure: true });
    expect(secure).toBe("__Host-session=v; Path=/; HttpOnly; SameSite=Lax; Max-Age=5; Secure");
  });

  test("a negative lifetime never produces a negative Max-Age", () => {
    expect(serializeSessionCookie({ name: "s", value: "v", maxAgeSec: -50, secure: false })).toContain("Max-Age=0");
  });

  test("clear expires immediately", () => {
    expect(clearSessionCookie("session", false)).toContain("session=; ");
    expect(clearSessionCookie("session", false)).toContain("Max-Age=0");
  });

  test("readCookie finds the named cookie among others", () => {
    expect(readCookie("a=1; session=tok; b=2", "session")).toBe("tok");
    expect(readCookie("a=1", "session")).toBeNull();
    expect(readCookie(undefined, "session")).toBeNull();
    expect(readCookie("session=", "session")).toBeNull();
  });

  test("readCookie does not match a name that merely ends the same way", () => {
    expect(readCookie("xsession=bad", "session")).toBeNull();
    expect(readCookie("__Host-session=ok", "session")).toBeNull();
  });
});
