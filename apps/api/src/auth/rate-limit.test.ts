import { describe, expect, test } from "bun:test";
import { AUTH_LIMITS, createRateLimiter, type RateLimitRule } from "./rate-limit";
import { createMemoryRateLimitStore } from "./rate-limit-memory-store";

const rule: RateLimitRule = { name: "test", limit: 3, windowMs: 60_000 };

function setup(random = () => 1) {
  const { store, counts } = createMemoryRateLimitStore();
  let clock = new Date("2026-10-15T00:00:10Z"); // 10 s into a minute window
  const limiter = createRateLimiter({ store, secret: "k".repeat(32), now: () => clock, random });
  return { limiter, counts, advance: (ms: number) => (clock = new Date(clock.getTime() + ms)) };
}

describe("check", () => {
  test("allows up to the limit, then blocks", async () => {
    const { limiter } = setup();
    for (let i = 0; i < 3; i++) expect((await limiter.check(rule, "a")).allowed).toBe(true);
    expect((await limiter.check(rule, "a")).allowed).toBe(false);
    expect((await limiter.check(rule, "a")).allowed).toBe(false);
  });

  test("reports how long until the window ends", async () => {
    const { limiter } = setup();
    for (let i = 0; i < 3; i++) await limiter.check(rule, "a");
    const blocked = await limiter.check(rule, "a");
    expect(blocked).toEqual({ allowed: false, retryAfterSec: 50 }); // 10 s in, 60 s window
  });

  test("a new window starts a fresh count", async () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 4; i++) await limiter.check(rule, "a");
    advance(51_000);
    expect((await limiter.check(rule, "a")).allowed).toBe(true);
  });

  test("each identifier and each rule count separately", async () => {
    const { limiter } = setup();
    for (let i = 0; i < 4; i++) await limiter.check(rule, "a");
    expect((await limiter.check(rule, "b")).allowed).toBe(true);
    expect((await limiter.check({ ...rule, name: "other" }, "a")).allowed).toBe(true);
  });

  test("stores a hash, never the email or IP", async () => {
    const { limiter, counts } = setup();
    await limiter.check(rule, "someone@example.com");
    await limiter.check(rule, "203.0.113.9");
    for (const { key } of counts.values()) {
      expect(key).not.toContain("someone");
      expect(key).not.toContain("203.0.113.9");
      expect(key).toMatch(/^test:[0-9a-f]{64}$/);
    }
  });

  test("old windows are pruned when a new window opens", async () => {
    const { limiter, counts, advance } = setup(() => 0); // always run the housekeeping
    await limiter.check(rule, "old");
    advance(2 * 24 * 3600 * 1000);
    await limiter.check(rule, "new");
    expect(counts.size).toBe(1);
  });
});

describe("checkAll", () => {
  test("counts every rule even when an earlier one is already over", async () => {
    const { limiter } = setup();
    const strict: RateLimitRule = { name: "strict", limit: 1, windowMs: 60_000 };
    await limiter.checkAll([{ rule: strict, identifier: "a" }, { rule, identifier: "a" }]);
    const second = await limiter.checkAll([{ rule: strict, identifier: "a" }, { rule, identifier: "a" }]);
    expect(second.allowed).toBe(false);
    // The loose rule saw both hits as well (2 of 3), so a third round trips it.
    expect((await limiter.check(rule, "a")).allowed).toBe(true);
    expect((await limiter.check(rule, "a")).allowed).toBe(false);
  });

  test("reports the longest wait among the rules that blocked", async () => {
    const { limiter } = setup();
    const short: RateLimitRule = { name: "short", limit: 0, windowMs: 60_000 };
    const long: RateLimitRule = { name: "long", limit: 0, windowMs: 600_000 };
    const result = await limiter.checkAll([{ rule: short, identifier: "a" }, { rule: long, identifier: "a" }]);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.retryAfterSec).toBeGreaterThan(50);
  });
});

test("the auth limits are sensible", () => {
  expect(AUTH_LIMITS.otpRequestEmail.limit).toBeLessThan(AUTH_LIMITS.otpRequestIp.limit);
  expect(AUTH_LIMITS.otpVerifyEmail.limit).toBeLessThan(AUTH_LIMITS.otpVerifyIp.limit);
});
