import { describe, expect, test } from "bun:test";
import { FRESH_LOGIN_MS, SESSION_POLICY, SESSION_TOUCH_INTERVAL_MS } from "./session";
import type { AuthUser } from "./user";
import { createMemorySessionStore } from "./session-memory-store";
import { createSessionService } from "./session-service";

const DAY = 24 * 3600 * 1000;
const participant: AuthUser = { id: "u1", email: "p@example.com", role: "participant", locale: "ja" };
const admin: AuthUser = { id: "u2", email: "a@example.com", role: "admin", locale: "en" };

function setup() {
  const users = new Map<string, AuthUser>([
    [participant.id, participant],
    [admin.id, admin],
  ]);
  const { store, rows } = createMemorySessionStore(users);
  let clock = new Date("2026-10-15T00:00:00Z");
  const service = createSessionService({ store, now: () => clock });
  return { service, rows, users, advance: (ms: number) => (clock = new Date(clock.getTime() + ms)) };
}

describe("endOthers", () => {
  test("ends the account's other sessions, keeps the one named, and leaves other accounts alone", async () => {
    const { service, rows } = setup();
    const keep = await service.create(participant);
    const other = await service.create(participant);
    const admins = await service.create(admin);
    const keptId = (await service.authenticate(keep.token))!.sessionId;

    await service.endOthers(participant.id, keptId);

    expect(await service.authenticate(other.token)).toBeNull();
    expect((await service.authenticate(keep.token))?.user.id).toBe(participant.id);
    expect((await service.authenticate(admins.token))?.user.id).toBe(admin.id);
    expect(rows).toHaveLength(2);
  });
});

describe("create", () => {
  test("a participant session lasts about a year", async () => {
    const { service, rows } = setup();
    const { expiresAt } = await service.create(participant);

    expect(expiresAt.getTime() - new Date("2026-10-15T00:00:00Z").getTime()).toBe(365 * DAY);
    expect(rows[0]!.absoluteExpiresAt).toEqual(expiresAt);
  });

  test("an admin session is 14 days idle inside a 30 day cap", async () => {
    const { service, rows } = setup();
    const { expiresAt } = await service.create(admin);
    const start = new Date("2026-10-15T00:00:00Z").getTime();

    expect(expiresAt.getTime() - start).toBe(14 * DAY);
    expect(rows[0]!.absoluteExpiresAt.getTime() - start).toBe(30 * DAY);
  });

  test("stores only the hash of the token it returns", async () => {
    const { service, rows } = setup();
    const { token } = await service.create(participant);
    expect(rows[0]!.tokenHash).not.toBe(token);
    expect(rows[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("authenticate", () => {
  test("returns the user for a live session", async () => {
    const { service } = setup();
    const { token } = await service.create(participant);
    const auth = await service.authenticate(token);
    expect(auth?.user.id).toBe("u1");
  });

  test("unknown or tampered tokens are rejected", async () => {
    const { service } = setup();
    const { token } = await service.create(participant);
    expect(await service.authenticate("nope")).toBeNull();
    expect(await service.authenticate(token + "x")).toBeNull();
  });

  test("an admin who stays idle for 14 days is logged out, and the row is removed", async () => {
    const { service, rows, advance } = setup();
    const { token } = await service.create(admin);
    advance(14 * DAY);
    expect(await service.authenticate(token)).toBeNull();
    expect(rows).toHaveLength(0);
  });

  test("an admin who keeps using it slides the idle window", async () => {
    const { service, advance } = setup();
    const { token } = await service.create(admin);

    advance(10 * DAY);
    const mid = await service.authenticate(token);
    expect(mid?.refreshed).toBe(true);

    // 10 more days: 20 days since login, but only 10 since last use.
    advance(10 * DAY);
    expect(await service.authenticate(token)).not.toBeNull();
  });

  test("sliding never goes past the 30 day absolute cap", async () => {
    const { service, advance } = setup();
    const { token } = await service.create(admin);

    for (let day = 0; day < 29; day++) {
      advance(DAY);
      expect(await service.authenticate(token)).not.toBeNull();
    }
    advance(DAY + 1000); // day 30
    expect(await service.authenticate(token)).toBeNull();
  });

  test("a slid expiry is capped at the absolute expiry", async () => {
    const { service, rows, advance } = setup();
    const { token } = await service.create(admin);
    advance(13 * DAY); // inside the 14 day idle window
    expect((await service.authenticate(token))?.refreshed).toBe(true);
    advance(13 * DAY); // day 26: idle would slide to day 40, the 30 day cap wins
    const auth = await service.authenticate(token);

    expect(auth?.expiresAt.getTime()).toBe(rows[0]!.absoluteExpiresAt.getTime());
    expect(rows[0]!.expiresAt.getTime()).toBe(rows[0]!.absoluteExpiresAt.getTime());
    expect(SESSION_POLICY.admin.idleMs).toBe(14 * DAY);
  });

  test("using it again right away does not rewrite the expiry", async () => {
    const { service, advance } = setup();
    const { token } = await service.create(admin);
    advance(SESSION_TOUCH_INTERVAL_MS / 4);
    const auth = await service.authenticate(token);
    expect(auth?.refreshed).toBe(false);
  });

  test("a participant session ends after a year", async () => {
    const { service, advance } = setup();
    const { token } = await service.create(participant);
    advance(364 * DAY);
    expect(await service.authenticate(token)).not.toBeNull();
    advance(2 * DAY);
    expect(await service.authenticate(token)).toBeNull();
  });

  test("a participant promoted to admin loses the year-long session; a new admin login works", async () => {
    const { service, users, advance } = setup();
    const promoted = { ...participant, id: "u3" };
    users.set(promoted.id, promoted);
    const { token } = await service.create(promoted);
    promoted.role = "admin";
    expect(await service.authenticate(token)).toBeNull();

    const fresh = await service.create(promoted);
    advance(DAY);
    expect(await service.authenticate(fresh.token)).not.toBeNull();
  });
});

describe("fresh login", () => {
  test("a new login is fresh for 10 minutes, then not", async () => {
    const { service, advance } = setup();
    const { token } = await service.create(admin);

    const now = await service.authenticate(token);
    expect(now).toMatchObject({ fresh: true, freshUntil: new Date("2026-10-15T00:10:00Z") });
    expect(now!.sessionId).toBeTruthy();

    advance(FRESH_LOGIN_MS);
    expect((await service.authenticate(token))!.fresh).toBe(false);
  });

  test("markFresh restarts the 10 minutes from now, on that session only", async () => {
    const { service, rows, advance } = setup();
    const a = await service.create(admin);
    const b = await service.create(admin);
    advance(DAY);

    const id = (await service.authenticate(a.token))!.sessionId;
    expect(await service.markFresh(id)).toEqual(new Date("2026-10-16T00:10:00Z"));
    expect(rows.find((r) => r.id === id)!.lastLoginAt).toEqual(new Date("2026-10-16T00:00:00Z"));
    expect((await service.authenticate(a.token))!.fresh).toBe(true);
    expect((await service.authenticate(b.token))!.fresh).toBe(false);
  });

  test("freshness never extends the session itself", async () => {
    const { service, advance } = setup();
    const { token } = await service.create(admin);
    // Stay active (under the 14 day idle limit) until just before the 30 day cap.
    for (let i = 0; i < 3; i++) {
      advance(10 * DAY - FRESH_LOGIN_MS / 6);
      expect(await service.authenticate(token)).not.toBeNull();
    }
    await service.markFresh((await service.authenticate(token))!.sessionId);
    advance(FRESH_LOGIN_MS / 2); // still fresh by the clock, but past the 30 day cap
    expect(await service.authenticate(token)).toBeNull();
  });
});

describe("destroy", () => {
  test("logs out: the token stops working", async () => {
    const { service, rows } = setup();
    const { token } = await service.create(participant);
    await service.destroy(token);
    expect(rows).toHaveLength(0);
    expect(await service.authenticate(token)).toBeNull();
  });

  test("destroying an unknown token is harmless", async () => {
    const { service } = setup();
    await expect(service.destroy("whatever")).resolves.toBeUndefined();
  });
});

describe("rotation", () => {
  const DUE = 30 * DAY;

  test("is not due at first, and is due after 30 days", async () => {
    const { service, advance } = setup();
    const { token } = await service.create(participant);
    expect((await service.authenticate(token))!.rotateDue).toBe(false);
    advance(DUE);
    expect((await service.authenticate(token))!.rotateDue).toBe(true);
  });

  test("the old token keeps working until the new one is used, then ends", async () => {
    const { service, rows, advance } = setup();
    const { token } = await service.create(participant);
    advance(DUE);
    const id = (await service.authenticate(token))!.sessionId;
    const next = await service.rotate(id);
    expect((await service.authenticate(token))?.user.id).toBe(participant.id); // the reply may have been lost
    expect((await service.authenticate(next))?.rotateDue).toBe(false);
    expect(await service.authenticate(token)).toBeNull();
    expect(rows).toHaveLength(1);
  });

  test("a phone that never got the new token rotates again, and its old token stays good", async () => {
    const { service, advance } = setup();
    const { token } = await service.create(participant);
    advance(DUE);
    const id = (await service.authenticate(token))!.sessionId;
    const lost = await service.rotate(id);
    expect((await service.authenticate(token))!.rotateDue).toBe(true);
    const next = await service.rotate(id);
    expect(await service.authenticate(lost)).toBeNull();
    expect((await service.authenticate(token))?.user.id).toBe(participant.id);
    expect((await service.authenticate(next))?.user.id).toBe(participant.id);
    expect(await service.authenticate(token)).toBeNull();
  });

  test("logging out with either token ends the session", async () => {
    const { service, rows, advance } = setup();
    const { token } = await service.create(participant);
    advance(DUE);
    await service.rotate((await service.authenticate(token))!.sessionId);
    await service.destroy(token);
    expect(rows).toHaveLength(0);
  });
});
