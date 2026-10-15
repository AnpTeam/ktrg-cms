// Runs the real Drizzle stores against a real PostgreSQL. Skipped unless TEST_DATABASE_URL is set:
//   TEST_DATABASE_URL=postgres://user:pass@localhost:5432/ktrg bun test src/db/integration.test.ts
// The database must already be migrated (bun run db:migrate). Every row it creates is tagged and
// removed afterwards, and it refuses to run against anything but localhost or a "test" database.
import { afterAll, describe, expect, test } from "bun:test";
import { randomBytes, randomUUID } from "node:crypto";
import { asc, eq, inArray, like, sql } from "drizzle-orm";
import { createDrizzleOtpStore } from "../auth/otp-store";
import { createDrizzlePasskeyStore } from "../auth/passkey-store";
import { createDrizzleRateLimitStore } from "../auth/rate-limit-store";
import { createDrizzleSessionStore } from "../auth/session-store";
import { createDb } from "./client";
import { auditLog, otpCodes, rallies, rateLimits, routes, spots, users, webauthnChallenges } from "./schema";
import { seed } from "./seed";
import { SEED_ROUTES } from "./seed-data";

const url = process.env.TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  const safe = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname) || /test/i.test(parsed.pathname);
  if (!safe) throw new Error(`Refusing to run integration tests against ${parsed.hostname}: use localhost or a *test* database.`);
}

/**
 * describe.skipIf still RUNS the describe body (it only skips the tests), so the connection must
 * not be opened when there is no database URL. Without one this returns an unused placeholder.
 */
function connect(): ReturnType<typeof createDb> {
  return url ? createDb(url) : ({ db: undefined, client: undefined } as unknown as ReturnType<typeof createDb>);
}

describe.skipIf(!url)("Drizzle stores on real PostgreSQL", () => {
  const { db, client } = connect();
  const otp = createDrizzleOtpStore(db);
  const sessions = createDrizzleSessionStore(db);
  const rate = createDrizzleRateLimitStore(db);
  const passkeys = createDrizzlePasskeyStore(db);

  const tag = `it${randomUUID().slice(0, 8)}`;
  const email = (n: string) => `${tag}-${n}@example.test`;
  const extraUserIds: string[] = [];
  const challengeValues: string[] = [];
  const future = () => new Date(Date.now() + 10 * 60_000);
  const key = (n: string) => `${tag}-${n}`;

  afterAll(async () => {
    await db.delete(users).where(like(users.email, `${tag}-%`));
    if (extraUserIds.length) await db.delete(users).where(inArray(users.id, extraUserIds));
    await db.delete(otpCodes).where(like(otpCodes.email, `${tag}-%`));
    await db.delete(rateLimits).where(like(rateLimits.key, `${tag}-%`));
    if (challengeValues.length) await db.delete(webauthnChallenges).where(inArray(webauthnChallenges.challenge, challengeValues));
    await client.end();
  });

  async function newUser(n: string) {
    return otp.findOrCreateUser(email(n));
  }
  const newCredential = () => ({
    credentialId: randomBytes(24).toString("base64url"),
    publicKey: new Uint8Array(randomBytes(77)),
    counter: 0,
    label: null as string | null,
  });

  describe("schema", () => {
    test("email is unique ignoring case, but many accounts may have no email", async () => {
      await db.insert(users).values({ email: email("Case") });
      await expect(
        (async () => {
          await db.insert(users).values({ email: email("case").toUpperCase() });
        })(),
      ).rejects.toThrow();

      const a = await db.insert(users).values({}).returning({ id: users.id });
      const b = await db.insert(users).values({}).returning({ id: users.id });
      extraUserIds.push(a[0]!.id, b[0]!.id);
      expect(a[0]!.id).not.toBe(b[0]!.id);
    });

    test("there can only ever be one rally row", async () => {
      const existing = await db.select({ id: rallies.id }).from(rallies);
      if (existing.length === 0) {
        await db.insert(rallies).values({});
        await db.delete(rallies);
      } else {
        await expect(
          (async () => {
            await db.insert(rallies).values({});
          })(),
        ).rejects.toThrow();
      }
    });
  });

  describe("OTP store", () => {
    test("latest returns the newest code; insert stores the hash", async () => {
      const e = email("otp-latest");
      await otp.insert({ email: e, codeHash: "a".repeat(64), expiresAt: new Date(Date.now() + 1000) });
      await otp.insert({ email: e, codeHash: "b".repeat(64), expiresAt: future() });

      const row = await otp.latest(e);
      expect(row?.codeHash).toBe("b".repeat(64));
      expect(row).toMatchObject({ attempts: 0, usedAt: null });
      expect(await otp.latest(email("nobody"))).toBeNull();
    });

    test("10 parallel guesses against a limit of 5: exactly 5 are counted", async () => {
      const e = email("otp-attempts");
      await otp.insert({ email: e, codeHash: "c".repeat(64), expiresAt: future() });
      const row = (await otp.latest(e))!;

      const results = await Promise.all(Array.from({ length: 10 }, () => otp.consumeAttempt(row.id, 5)));

      expect(results.filter(Boolean)).toHaveLength(5);
      expect((await otp.latest(e))!.attempts).toBe(5);
    });

    test("a code can be marked used only once, even in parallel", async () => {
      const e = email("otp-used");
      await otp.insert({ email: e, codeHash: "d".repeat(64), expiresAt: future() });
      const row = (await otp.latest(e))!;

      const results = await Promise.all([otp.markUsed(row.id, new Date()), otp.markUsed(row.id, new Date())]);

      expect(results.filter(Boolean)).toHaveLength(1);
      expect((await otp.latest(e))!.usedAt).toBeInstanceOf(Date);
      expect(await otp.consumeAttempt(row.id, 5)).toBe(false); // a used code takes no more guesses
    });

    test("findOrCreateUser: 5 parallel first logins make exactly one user", async () => {
      const e = email("otp-user");
      const made = await Promise.all(Array.from({ length: 5 }, () => otp.findOrCreateUser(e)));

      expect(new Set(made.map((u) => u.id)).size).toBe(1);
      expect(made[0]).toMatchObject({ email: e, role: "participant", locale: "ja" });
      const rows = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${e}`);
      expect(rows).toHaveLength(1);
    });

    test("promoteToAdmin: 3 parallel calls promote once and write exactly one audit row", async () => {
      const user = await otp.findOrCreateUser(email("otp-admin"));
      try {
        const results = await Promise.all(Array.from({ length: 3 }, () => otp.promoteToAdmin(user.id)));
        expect(results.filter(Boolean)).toHaveLength(1);

        const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, user.id));
        expect(row!.role).toBe("admin");
        const audits = await db.select().from(auditLog).where(eq(auditLog.targetId, user.id));
        expect(audits).toHaveLength(1);
        expect(audits[0]).toMatchObject({ actorUserId: user.id, action: "user.role.bootstrap_admin", targetType: "user" });

        expect(await otp.promoteToAdmin(user.id)).toBe(false);
      } finally {
        await db.delete(auditLog).where(eq(auditLog.targetId, user.id));
      }
    });
  });

  describe("session store", () => {
    test("create, find (with the user), touch, remove", async () => {
      const user = await newUser("session");
      const tokenHash = randomBytes(32).toString("hex");
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 14 * 86_400_000);
      const absoluteExpiresAt = new Date(now.getTime() + 30 * 86_400_000);

      await sessions.create({ userId: user.id, tokenHash, expiresAt, absoluteExpiresAt, now });
      const found = await sessions.find(tokenHash);
      expect(found?.user).toEqual(user);
      expect(found?.session.absoluteExpiresAt.getTime()).toBe(absoluteExpiresAt.getTime());

      const slid = new Date(now.getTime() + 20 * 86_400_000);
      await sessions.touch(found!.session.id, new Date(), slid);
      expect((await sessions.find(tokenHash))!.session.expiresAt.getTime()).toBe(slid.getTime());

      // A fresh-login re-check moves last_login_at, nothing else.
      expect(found!.session.lastLoginAt.getTime()).toBe(now.getTime());
      const recheck = new Date(now.getTime() + 3_600_000);
      await sessions.markFresh(found!.session.id, recheck);
      const after = (await sessions.find(tokenHash))!.session;
      expect(after.lastLoginAt.getTime()).toBe(recheck.getTime());
      expect(after.expiresAt.getTime()).toBe(slid.getTime());

      await sessions.remove(tokenHash);
      expect(await sessions.find(tokenHash)).toBeNull();
    });

    test("deleting a user removes their sessions", async () => {
      const user = await newUser("session-cascade");
      const tokenHash = randomBytes(32).toString("hex");
      await sessions.create({ userId: user.id, tokenHash, expiresAt: future(), absoluteExpiresAt: future(), now: new Date() });
      await db.delete(users).where(inArray(users.id, [user.id]));
      expect(await sessions.find(tokenHash)).toBeNull();
    });
  });

  describe("rate limit store", () => {
    test("hit counts up per key and window", async () => {
      const w1 = new Date("2026-10-15T00:00:00Z");
      const w2 = new Date("2026-10-15T00:15:00Z");
      expect(await rate.hit(key("a"), w1)).toBe(1);
      expect(await rate.hit(key("a"), w1)).toBe(2);
      expect(await rate.hit(key("a"), w2)).toBe(1);
      expect(await rate.hit(key("b"), w1)).toBe(1);
    });

    test("20 parallel hits are counted exactly: 1..20, none lost, none repeated", async () => {
      const w = new Date("2026-10-15T00:00:00Z");
      const counts = await Promise.all(Array.from({ length: 20 }, () => rate.hit(key("par"), w)));
      expect([...counts].sort((x, y) => x - y)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    });

    test("prune forgets old windows only", async () => {
      await rate.hit(key("prune"), new Date("2020-01-01T00:00:00Z"));
      await rate.hit(key("prune"), new Date("2030-01-01T00:00:00Z"));
      await rate.prune(new Date("2025-01-01T00:00:00Z"));

      expect(await rate.hit(key("prune"), new Date("2020-01-01T00:00:00Z"))).toBe(1); // was forgotten
      expect(await rate.hit(key("prune"), new Date("2030-01-01T00:00:00Z"))).toBe(2); // was kept
    });
  });

  describe("passkey store", () => {
    test("challenges: used once, only for the right type and owner, never when expired", async () => {
      const owner = await newUser("chal-owner");
      const other = await newUser("chal-other");
      const c = (n: string) => {
        const v = `${tag}-${n}-${randomBytes(6).toString("hex")}`;
        challengeValues.push(v);
        return v;
      };
      const base = { pendingUserId: null, expiresAt: future() };

      const mine = c("mine");
      await passkeys.saveChallenge({ ...base, challenge: mine, type: "registration", userId: owner.id });
      expect(await passkeys.takeChallenge(mine, "registration", other.id, new Date())).toBeNull();
      expect(await passkeys.takeChallenge(mine, "authentication", owner.id, new Date())).toBeNull();
      expect(await passkeys.takeChallenge(mine, "registration", owner.id, new Date())).toEqual({ pendingUserId: null });
      expect(await passkeys.takeChallenge(mine, "registration", owner.id, new Date())).toBeNull(); // used up

      const old = c("old");
      await passkeys.saveChallenge({ ...base, challenge: old, type: "authentication", userId: null, expiresAt: new Date(Date.now() - 1000) });
      expect(await passkeys.takeChallenge(old, "authentication", null, new Date())).toBeNull();

      const pending = randomUUID();
      const signup = c("signup");
      await passkeys.saveChallenge({ ...base, challenge: signup, type: "registration", userId: null, pendingUserId: pending });
      expect(await passkeys.takeChallenge(signup, "registration", null, new Date())).toEqual({ pendingUserId: pending });
    });

    test("only one of two parallel takes of the same challenge wins", async () => {
      const v = `${tag}-race-${randomBytes(6).toString("hex")}`;
      challengeValues.push(v);
      await passkeys.saveChallenge({ challenge: v, type: "authentication", userId: null, pendingUserId: null, expiresAt: future() });
      const results = await Promise.all([
        passkeys.takeChallenge(v, "authentication", null, new Date()),
        passkeys.takeChallenge(v, "authentication", null, new Date()),
      ]);
      expect(results.filter((r) => r !== null)).toHaveLength(1);
    });

    test("a stored public key comes back byte for byte; a credential id is unique", async () => {
      const user = await newUser("pk-store");
      const cred = newCredential();

      expect(await passkeys.insertPasskey({ userId: user.id, ...cred, label: "My iPhone" })).toBe(true);
      expect(await passkeys.insertPasskey({ userId: user.id, ...cred })).toBe(false);

      const found = await passkeys.findCredential(cred.credentialId);
      expect(found?.userId).toBe(user.id);
      expect(Buffer.from(found!.publicKey).equals(Buffer.from(cred.publicKey))).toBe(true);
      expect(await passkeys.credentialIds(user.id)).toEqual([cred.credentialId]);

      await passkeys.updateCounter(cred.credentialId, 7);
      expect((await passkeys.findCredential(cred.credentialId))!.counter).toBe(7);
      expect(await passkeys.findCredential("unknown")).toBeNull();
    });

    test("a passkey-only account is created with its passkey, with no email", async () => {
      const id = randomUUID();
      extraUserIds.push(id);
      const cred = newCredential();

      expect(await passkeys.createUserWithPasskey({ userId: id, ...cred, label: "first" })).toBe(true);

      expect(await passkeys.userById(id)).toEqual({ id, email: null, role: "participant", locale: "ja" });
      expect((await passkeys.list(id)).map((p) => p.label)).toEqual(["first"]);
    });

    test("a taken credential id rolls the whole sign-up back: no stray account", async () => {
      const owner = await newUser("pk-taken");
      const cred = newCredential();
      await passkeys.insertPasskey({ userId: owner.id, ...cred });

      const strayId = randomUUID();
      extraUserIds.push(strayId);
      expect(await passkeys.createUserWithPasskey({ userId: strayId, ...cred, label: null })).toBe(false);

      expect(await passkeys.userById(strayId)).toBeNull();
    });

    test("list shows own passkeys oldest first, with no key material", async () => {
      const user = await newUser("pk-list");
      const other = await newUser("pk-list-other");
      await passkeys.insertPasskey({ userId: user.id, ...newCredential(), label: "one" });
      await new Promise((r) => setTimeout(r, 15));
      await passkeys.insertPasskey({ userId: user.id, ...newCredential(), label: "two" });
      await passkeys.insertPasskey({ userId: other.id, ...newCredential(), label: "not mine" });

      const list = await passkeys.list(user.id);
      expect(list.map((p) => p.label)).toEqual(["one", "two"]);
      expect(Object.keys(list[0]!).sort()).toEqual(["createdAt", "id", "label"]);
    });

    test("remove: own passkey only; the last one is kept when asked", async () => {
      const user = await newUser("pk-remove");
      const other = await newUser("pk-remove-other");
      await passkeys.insertPasskey({ userId: user.id, ...newCredential(), label: "a" });
      await passkeys.insertPasskey({ userId: other.id, ...newCredential(), label: "theirs" });
      const [mine] = await passkeys.list(user.id);
      const [theirs] = await passkeys.list(other.id);

      expect(await passkeys.remove(user.id, theirs!.id, { keepAtLeastOne: false })).toEqual({ ok: false, reason: "not_found" });
      expect(await passkeys.remove(user.id, mine!.id, { keepAtLeastOne: true })).toEqual({ ok: false, reason: "last_method" });
      expect(await passkeys.list(user.id)).toHaveLength(1);
      expect(await passkeys.remove(user.id, mine!.id, { keepAtLeastOne: false })).toEqual({ ok: true, label: "a" });
      expect(await passkeys.list(user.id)).toEqual([]);
      expect(await passkeys.list(other.id)).toHaveLength(1);
    });

    test("removing the last two at once still leaves one (row lock)", async () => {
      const user = await newUser("pk-race");
      await passkeys.insertPasskey({ userId: user.id, ...newCredential(), label: "x" });
      await passkeys.insertPasskey({ userId: user.id, ...newCredential(), label: "y" });
      const [a, b] = await passkeys.list(user.id);

      const results = await Promise.all([
        passkeys.remove(user.id, a!.id, { keepAtLeastOne: true }),
        passkeys.remove(user.id, b!.id, { keepAtLeastOne: true }),
      ]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(await passkeys.list(user.id)).toHaveLength(1);
    });

    test("deleting a user removes their passkeys and challenges", async () => {
      const user = await newUser("pk-cascade");
      const cred = newCredential();
      await passkeys.insertPasskey({ userId: user.id, ...cred });
      await db.delete(users).where(inArray(users.id, [user.id]));
      expect(await passkeys.findCredential(cred.credentialId)).toBeNull();
    });
  });
});

describe.skipIf(!url)("seed on real PostgreSQL", () => {
  const { db, client } = connect();
  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
  class Rollback extends Error {}

  afterAll(async () => {
    await client.end();
  });

  /** Runs in a transaction that is ALWAYS rolled back, so it never changes the real data. */
  async function inRollback(body: (tx: Tx) => Promise<void>) {
    let failure: unknown;
    await db
      .transaction(async (tx) => {
        try {
          // Start from an empty database inside the transaction (undone afterwards).
          await tx.delete(spots);
          await tx.delete(routes);
          await tx.delete(rallies);
          await body(tx);
        } catch (err) {
          failure = err;
        }
        throw new Rollback();
      })
      .catch((err) => {
        if (!(err instanceof Rollback)) throw err;
      });
    if (failure) throw failure;
  }

  test("fills an empty database: 1 rally, 19 routes in order, 28 draft spots", async () => {
    await inRollback(async (tx) => {
      expect(await seed(tx)).toEqual({ rally: true, routes: 19, spots: 28 });

      expect(await tx.select().from(rallies)).toHaveLength(1);
      const rs = await tx.select().from(routes).orderBy(asc(routes.sortOrder));
      expect(rs.map((r) => r.nameJa)).toEqual(SEED_ROUTES.map((r) => r.nameJa));
      expect(rs.map((r) => r.sortOrder)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));

      const ss = await tx.select().from(spots);
      expect(ss).toHaveLength(28);
      for (const s of ss) {
        expect(s.lat).toBeNull(); // coordinates are never guessed
        expect(s.lng).toBeNull();
        expect(s.published).toBe(false);
        expect(s.permissionConfirmed).toBe(false);
        expect(s.routeId).toBe(rs[0]!.id);
      }
    });
  });

  test("running it again changes nothing", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      expect(await seed(tx)).toEqual({ rally: false, routes: 0, spots: 0 });
      expect(await tx.select().from(routes)).toHaveLength(19);
      expect(await tx.select().from(spots)).toHaveLength(28);
      expect(await tx.select().from(rallies)).toHaveLength(1);
    });
  });

  test("it never overwrites what was edited in the CMS", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      await tx.update(routes).set({ nameJa: "編集済み", videoUrl: "https://youtu.be/x" }).where(eq(routes.sortOrder, 1));

      await seed(tx);

      const [first] = await tx.select().from(routes).where(eq(routes.sortOrder, 1));
      expect(first).toMatchObject({ nameJa: "編集済み", videoUrl: "https://youtu.be/x" });
    });
  });

  test("a placeholder spot cannot be published: the database refuses", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      await expect(
        (async () => {
          await tx.transaction(async (t) => {
            await t.update(spots).set({ published: true, permissionConfirmed: true });
          });
        })(),
      ).rejects.toThrow(); // no coordinates
      expect((await tx.select().from(spots).where(eq(spots.published, true))).length).toBe(0);
    });
  });
});
