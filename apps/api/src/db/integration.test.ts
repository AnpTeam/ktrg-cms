// Runs the real Drizzle stores against a real PostgreSQL. Skipped unless TEST_DATABASE_URL is set:
//   TEST_DATABASE_URL=postgres://user:pass@localhost:5432/ktrg bun test src/db/integration.test.ts
// The database must already be migrated (bun run db:migrate). Every row it creates is tagged and
// removed afterwards, and it refuses to run against anything but localhost or a "test" database.
import { afterAll, describe, expect, test } from "bun:test";
import { randomBytes, randomUUID } from "node:crypto";
import { asc, eq, inArray, like, sql } from "drizzle-orm";
import { createDrizzleAuditWriter, writeAudit } from "../audit/audit-store";
import { createDrizzleOtpStore } from "../auth/otp-store";
import { createDrizzleContentStore } from "../content/content-store";
import { createDrizzleMeStore } from "../me/me-store";
import { createDrizzlePasskeyStore } from "../auth/passkey-store";
import { createDrizzleRateLimitStore } from "../auth/rate-limit-store";
import { createDrizzleSessionStore } from "../auth/session-store";
import { createDb } from "./client";
import { listRalliesWithProgress } from "../rallies/rally-store";
import { auditLog, otpCodes, rallies, rallySpots, rateLimits, routes, spots, stamps, users, webauthnChallenges } from "./schema";
import { seed } from "./seed";
import { SEED_ROUTES, SEED_SPOTS } from "./seed-data";

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

  describe("me store", () => {
    test("update sets language and name; read back the same", async () => {
      const me = createDrizzleMeStore(db);
      const user = await newUser("me-update");
      const updated = await me.update(user.id, { locale: "en", displayName: "山田 太郎" });
      expect(updated).toMatchObject({ id: user.id, email: user.email, role: "participant", locale: "en", displayName: "山田 太郎" });
      expect(await me.get(user.id)).toEqual(updated);
      expect((await me.update(user.id, { displayName: null }))!.displayName).toBeNull();
      expect(await me.get(randomUUID())).toBeNull();
    });

    test("where you come from can be set and cleared", async () => {
      const me = createDrizzleMeStore(db);
      const user = await newUser("me-origin");
      expect((await me.get(user.id))!.origin).toBeNull();
      expect((await me.update(user.id, { origin: "nara" }))!.origin).toBe("nara");
      expect((await me.update(user.id, { origin: null }))!.origin).toBeNull();
    });

    test("every account gets its own 8-digit ID", async () => {
      const me = createDrizzleMeStore(db);
      const a = await newUser("pid-a");
      const b = await newUser("pid-b");
      const pa = (await me.get(a.id))!.publicId;
      const pb = (await me.get(b.id))!.publicId;
      expect(pa).toMatch(/^\d{8}$/);
      expect(pb).toMatch(/^\d{8}$/);
      expect(pa).not.toBe(pb);
    });

    test("purgeDue deletes only accounts requested before the cutoff, and audits by id", async () => {
      const me = createDrizzleMeStore(db);
      const old = await newUser("purge-old");
      const fresh = await newUser("purge-fresh");
      const never = await newUser("purge-never");
      await me.requestDeletion(old.id, new Date("2026-01-01T00:00:00Z"));
      await me.requestDeletion(fresh.id, new Date("2026-06-01T00:00:00Z"));
      try {
        expect(await me.purgeDue(new Date("2026-03-01T00:00:00Z"))).toBe(1);
        expect(await me.get(old.id)).toBeNull();
        expect(await me.get(fresh.id)).not.toBeNull();
        expect(await me.get(never.id)).not.toBeNull();
        const rows = await db.select().from(auditLog).where(eq(auditLog.targetId, old.id));
        expect(rows.map((r) => r.action).sort()).toEqual(["user.deleted", "user.deletion_request"]);
      } finally {
        await db.delete(auditLog).where(inArray(auditLog.targetId, [old.id, fresh.id, never.id]));
      }
    });

    test("age range and gender can be set (including 'unspecified') and cleared", async () => {
      const me = createDrizzleMeStore(db);
      const user = await newUser("me-about");
      expect(await me.get(user.id)).toMatchObject({ ageRange: null, gender: null });
      expect(await me.update(user.id, { ageRange: "60s", gender: "unspecified" })).toMatchObject({ ageRange: "60s", gender: "unspecified" });
      expect(await me.update(user.id, { ageRange: null, gender: null })).toMatchObject({ ageRange: null, gender: null });
    });

    test("preferences are saved as a whole, read back and replaced (jsonb)", async () => {
      const me = createDrizzleMeStore(db);
      const user = await newUser("me-prefs");
      expect((await me.get(user.id))!.preferences).toBeNull();
      const first = { size: "large", mergeStops: false, placesOnMap: true, setupDone: true, updatedAt: 1760000000000 } as const;
      expect((await me.update(user.id, { preferences: first }))!.preferences).toEqual(first);
      const second = { size: "xlarge", mergeStops: true, placesOnMap: false, setupDone: true, updatedAt: 1760000100000 } as const;
      await me.update(user.id, { preferences: second });
      expect((await me.get(user.id))!.preferences).toEqual(second);
      // A change to something else leaves them alone.
      await me.update(user.id, { displayName: "Hana" });
      expect((await me.get(user.id))!.preferences).toEqual(second);
    });

    test("deletion: 3 parallel requests write one audit row; cancel writes one more", async () => {
      const me = createDrizzleMeStore(db);
      const user = await newUser("me-delete");
      try {
        const at = new Date();
        const results = await Promise.all(Array.from({ length: 3 }, () => me.requestDeletion(user.id, at)));
        expect(results.filter((r) => r!.changed)).toHaveLength(1);
        expect((await me.get(user.id))!.deletionRequestedAt!.getTime()).toBe(at.getTime());

        expect((await me.cancelDeletion(user.id))!.changed).toBe(true);
        expect((await me.cancelDeletion(user.id))!.changed).toBe(false);
        expect((await me.get(user.id))!.deletionRequestedAt).toBeNull();

        const rows = await db.select().from(auditLog).where(eq(auditLog.targetId, user.id));
        expect(rows.map((r) => r.action).sort()).toEqual(["user.deletion_cancel", "user.deletion_request"]);
        expect(rows.every((r) => r.actorUserId === user.id && r.targetType === "user")).toBe(true);
      } finally {
        await db.delete(auditLog).where(eq(auditLog.targetId, user.id));
      }
    });
  });

  describe("audit log", () => {
    test("the writer stores ids only; a bad entry writes nothing", async () => {
      const user = await newUser("audit-writer");
      const target = randomUUID();
      const audit = createDrizzleAuditWriter(db);
      try {
        await audit.record({ actorUserId: user.id, action: "passkey.remove", targetId: target });
        await expect(audit.record({ actorUserId: user.id, action: "passkey.remove", targetId: user.email })).rejects.toThrow(
          /must be a UUID/,
        );

        const rows = await db.select().from(auditLog).where(eq(auditLog.actorUserId, user.id));
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ action: "passkey.remove", targetType: "passkey", targetId: target });
        expect(JSON.stringify(rows)).not.toContain(user.email!);
      } finally {
        await db.delete(auditLog).where(eq(auditLog.actorUserId, user.id));
      }
    });

    test("written inside a transaction, the row rolls back with the change", async () => {
      const user = await newUser("audit-rollback");
      await expect(
        db.transaction(async (tx) => {
          await writeAudit(tx, { actorUserId: user.id, action: "session.reauth", targetId: user.id });
          throw new Error("the change failed");
        }),
      ).rejects.toThrow("the change failed");
      expect(await db.select().from(auditLog).where(eq(auditLog.actorUserId, user.id))).toEqual([]);
    });

    test("rows outlive the actor's account, with the actor set to null", async () => {
      const user = await newUser("audit-deleted");
      await writeAudit(db, { actorUserId: user.id, action: "session.reauth", targetId: user.id });
      await db.delete(users).where(eq(users.id, user.id));
      try {
        const rows = await db.select().from(auditLog).where(eq(auditLog.targetId, user.id));
        expect(rows).toHaveLength(1);
        expect(rows[0]!.actorUserId).toBeNull();
      } finally {
        await db.delete(auditLog).where(eq(auditLog.targetId, user.id));
      }
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

      expect(await passkeys.insertPasskey({ userId: user.id, ...cred, label: "My iPhone" })).toMatch(/^[0-9a-f-]{36}$/);
      expect(await passkeys.insertPasskey({ userId: user.id, ...cred })).toBeNull();

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

      expect(await passkeys.createUserWithPasskey({ userId: id, ...cred, label: "first", profile: { displayName: "Hana", origin: "nara", locale: "en" } })).toBe(true);

      expect(await passkeys.userById(id)).toEqual({ id, email: null, role: "participant", locale: "en" });
      const [saved] = await db.select({ displayName: users.displayName, origin: users.origin }).from(users).where(eq(users.id, id));
      expect(saved).toEqual({ displayName: "Hana", origin: "nara" });
      expect((await passkeys.list(id)).map((p) => p.label)).toEqual(["first"]);
    });

    test("a taken credential id rolls the whole sign-up back: no stray account", async () => {
      const owner = await newUser("pk-taken");
      const cred = newCredential();
      await passkeys.insertPasskey({ userId: owner.id, ...cred });

      const strayId = randomUUID();
      extraUserIds.push(strayId);
      expect(await passkeys.createUserWithPasskey({ userId: strayId, ...cred, label: null, profile: { displayName: null, origin: null, locale: "ja" } })).toBe(false);

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
          // Rallies first: they hold the links to places and belong to courses.
          await tx.delete(rallies);
          await tx.delete(spots);
          await tx.delete(routes);
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

  test("fills an empty database: 20 rallies, 19 routes in order, 31 draft spots on their courses, 62 links", async () => {
    await inRollback(async (tx) => {
      expect(await seed(tx)).toEqual({ rallies: 20, routes: 19, spots: 31, links: 62 });

      expect(await tx.select().from(rallies)).toHaveLength(20);
      const rs = await tx.select().from(routes).orderBy(asc(routes.sortOrder));
      expect(rs.map((r) => r.nameJa)).toEqual(SEED_ROUTES.map((r) => r.nameJa));
      expect(rs.map((r) => r.sortOrder)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));

      const ss = await tx.select().from(spots);
      expect(ss).toHaveLength(31);
      const idOfCourse = (n: number) => rs[n - 1]!.id;
      for (const s of ss) {
        expect(s.lat).toBeNull(); // coordinates are never guessed
        expect(s.lng).toBeNull();
        expect(s.published).toBe(false);
        expect(s.permissionConfirmed).toBe(false);
        const wanted = SEED_SPOTS.find((x) => x.nameJa === s.nameJa)!;
        expect(s.routeId).toBe(idOfCourse(wanted.routeNumber));
        expect(s.sortOrder).toBe(wanted.sortOrder);
      }
      expect(ss.filter((s) => s.routeId === idOfCourse(3))).toHaveLength(0); // course 3 has no mound
    });
  });

  test("running it again changes nothing", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      expect(await seed(tx)).toEqual({ rallies: 0, routes: 0, spots: 0, links: 0 });
      expect(await tx.select().from(routes)).toHaveLength(19);
      expect(await tx.select().from(spots)).toHaveLength(31);
      expect(await tx.select().from(rallies)).toHaveLength(20);
      expect(await tx.select().from(rallySpots)).toHaveLength(62);
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

  test("one mound rally holds all 31 places, and each course rally the places on its course", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      const rs = await tx.select().from(routes).orderBy(asc(routes.sortOrder));
      const rl = await tx.select().from(rallies);
      const mounds = rl.filter((r) => r.kind === "mounds");
      expect(mounds).toHaveLength(1);
      expect(mounds[0]).toMatchObject({ nameJa: "経塚スタンプラリー", routeId: null });
      const links = await tx.select().from(rallySpots);
      expect(links.filter((l) => l.rallyId === mounds[0]!.id)).toHaveLength(31);

      const courses = rl.filter((r) => r.kind === "course");
      expect(courses).toHaveLength(19);
      expect(new Set(courses.map((c) => c.routeId)).size).toBe(19);
      const members = (course: number) => {
        const rally = courses.find((c) => c.routeId === rs[course - 1]!.id)!;
        return links.filter((l) => l.rallyId === rally.id).sort((x, y) => x.position - y.position);
      };
      expect(members(3)).toHaveLength(0); // course 3 has no mound yet
      expect(members(4)).toHaveLength(2);
      expect(members(11)).toHaveLength(3);
      expect(members(4).map((l) => l.position)).toEqual([1, 2]);

      // a place is in two rallies at once: the mound rally and its course's rally
      const aSpot = members(4)[0]!.spotId;
      expect(links.filter((l) => l.spotId === aSpot)).toHaveLength(2);
    });
  });

  test("the database refuses a second mound rally, a second rally for a course, and a course rally with no course", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      const [first] = await tx.select().from(routes).where(eq(routes.sortOrder, 1));
      const attempt = async (values: typeof rallies.$inferInsert) => {
        await expect(
          (async () => {
            await tx.transaction(async (t) => {
              await t.insert(rallies).values(values);
            });
          })(),
        ).rejects.toThrow();
      };
      await attempt({ kind: "mounds", nameJa: "もう一つ" });
      await attempt({ kind: "course", routeId: first!.id, nameJa: "同じコース" });
      await attempt({ kind: "course", nameJa: "コースなし" });
      await attempt({ kind: "mounds", routeId: first!.id, nameJa: "経塚なのにコース" });
      // a link cannot be made twice
      const [link] = await tx.select().from(rallySpots).limit(1);
      await expect(
        (async () => {
          await tx.transaction(async (t) => {
            await t.insert(rallySpots).values({ rallyId: link!.rallyId, spotId: link!.spotId });
          });
        })(),
      ).rejects.toThrow();
    });
  });

  test("deleting a rally removes its links, not the places or anyone's stamps", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      const [rally] = await tx.select().from(rallies).where(eq(rallies.kind, "mounds"));
      await tx.delete(rallies).where(eq(rallies.id, rally!.id));
      expect(await tx.select().from(rallySpots).where(eq(rallySpots.rallyId, rally!.id))).toHaveLength(0);
      expect(await tx.select().from(spots)).toHaveLength(31);
    });
  });

  test("progress: one stamp counts in the mound rally AND the course rally; others' stamps and drafts do not", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      const rs = await tx.select().from(routes).orderBy(asc(routes.sortOrder));
      const onCourse4 = await tx.select().from(spots).where(eq(spots.routeId, rs[3]!.id)).orderBy(asc(spots.sortOrder));
      const [a, b] = onCourse4 as [(typeof onCourse4)[number], (typeof onCourse4)[number]];

      // Publish a (coordinates and permission are required) and leave b a draft.
      await tx.update(spots).set({ lat: 34.3, lng: 135.1, permissionConfirmed: true, positionVerified: true, published: true }).where(eq(spots.id, a.id));
      const [me] = await tx.insert(users).values({}).returning({ id: users.id });
      const [other] = await tx.insert(users).values({}).returning({ id: users.id });
      await tx.insert(stamps).values([
        { userId: me!.id, spotId: a.id },
        { userId: other!.id, spotId: a.id },
        { userId: me!.id, spotId: b.id }, // a stamp on a draft place counts for nothing
      ]);

      const mine = await listRalliesWithProgress(tx, me!.id);
      const mounds = mine.find((r) => r.kind === "mounds")!;
      const course4 = mine.find((r) => r.routeId === rs[3]!.id)!;
      expect(mounds).toMatchObject({ total: 1, stamped: 1, complete: true });
      expect(course4).toMatchObject({ total: 1, stamped: 1, complete: true });
      expect(course4.lastStampedAt).toBeInstanceOf(Date);

      const theirs = await listRalliesWithProgress(tx, other!.id);
      expect(theirs.find((r) => r.kind === "mounds")).toMatchObject({ stamped: 1 });
      const nobody = await listRalliesWithProgress(tx, "00000000-0000-4000-8000-000000000000");
      expect(nobody.every((r) => r.stamped === 0 && r.lastStampedAt === null)).toBe(true);

      // an admin revokes my stamp: it counts for nothing any more, in both rallies
      await tx.update(stamps).set({ revokedAt: new Date() }).where(eq(stamps.userId, me!.id));
      const after = await listRalliesWithProgress(tx, me!.id);
      expect(after.find((r) => r.kind === "mounds")).toMatchObject({ stamped: 0, complete: false });
    });
  });

  test("a place cannot be published until its position is verified", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      const [s] = await tx.select().from(spots).limit(1);
      const publish = (verified: boolean) =>
        tx.transaction(async (t) => {
          await t
            .update(spots)
            .set({ lat: 34.3, lng: 135.1, permissionConfirmed: true, positionVerified: verified, published: true })
            .where(eq(spots.id, s!.id));
        });
      await expect(publish(false)).rejects.toThrow();
      await publish(true);
      expect((await tx.select().from(spots).where(eq(spots.id, s!.id)))[0]).toMatchObject({ published: true, positionVerified: true });
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

  describe("content store (admin routes and places)", () => {
    // Audit rows point at users; make one for the actor inside the rolled-back transaction.
    async function withAdmin(tx: Tx, body: (store: ReturnType<typeof createDrizzleContentStore>, actor: string) => Promise<void>) {
      await seed(tx);
      const [u] = await tx.insert(users).values({ role: "admin" }).returning({ id: users.id });
      await body(createDrizzleContentStore(tx as unknown as typeof db), u!.id);
    }

    test("a save with the loaded updatedAt works once; the same stale value is a conflict (microseconds do not break it)", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const [first] = await store.listRoutes();
          const a = await store.updateRoute(actor, first!.id, first!.updatedAt, { nameEn: "One" });
          expect(a).toMatchObject({ nameEn: "One" });
          expect(await store.updateRoute(actor, first!.id, first!.updatedAt, { nameEn: "Two" })).toBe("conflict");
          expect(await store.updateRoute(actor, "00000000-0000-4000-8000-000000000000", new Date(), {})).toBeNull();
          const fresh = a as { updatedAt: Date };
          expect(await store.updateRoute(actor, first!.id, fresh.updatedAt, { nameEn: "Three" })).toMatchObject({ nameEn: "Three" });
        });
      });
    });

    test("creating a place adds it to the route's course rally (not the mound rally) and audits it", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const list = await store.listRoutes();
          const course3 = list[2]!; // the seed gives course 3 no mounds
          const s = await store.createSpot(actor, course3.id, { nameJa: "新しい場所" });
          expect(s).toMatchObject({ published: false, positionVerified: false, sortOrder: 1 });
          const [rally] = await tx.select().from(rallies).where(eq(rallies.routeId, course3.id));
          const links = await tx.select().from(rallySpots).where(eq(rallySpots.spotId, s!.id));
          expect(links.map((l) => l.rallyId)).toEqual([rally!.id]);
          expect(links[0]!.position).toBe(1);
          const rows = await tx.select().from(auditLog).where(eq(auditLog.targetId, s!.id));
          expect(rows.map((r) => r.action)).toEqual(["spot.create"]);
          expect(rows[0]!.actorUserId).toBe(actor);
        });
      });
    });

    test("deleting: a route with places is refused; its empty course rally goes with it; a stamped place is refused", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const list = await store.listRoutes();
          expect(await store.deleteRoute(actor, list[3]!.id)).toBe("has_places");
          expect(await store.deleteRoute(actor, list[2]!.id)).toBe("ok");
          expect(await tx.select().from(rallies).where(eq(rallies.routeId, list[2]!.id))).toHaveLength(0);

          const [placeOnCourse4] = await tx.select().from(spots).where(eq(spots.routeId, list[3]!.id)).limit(1);
          const [visitor] = await tx.insert(users).values({}).returning({ id: users.id });
          await tx.insert(stamps).values({ userId: visitor!.id, spotId: placeOnCourse4!.id });
          expect(await store.deleteSpot(actor, placeOnCourse4!.id)).toBe("has_stamps");
          expect(await store.deleteSpot(actor, "00000000-0000-4000-8000-000000000000")).toBe("not_found");
        });
      });
    });

    test("publishing writes one audit row, a second publish writes none, and the database still guards the rules", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const list = await store.listRoutes();
          const [s] = await tx.select().from(spots).where(eq(spots.routeId, list[3]!.id)).limit(1);
          const before = await store.getSpot(s!.id);
          const ready = await store.updateSpot(actor, s!.id, before!.updatedAt, {
            lat: 34.3, lng: 135.1, positionVerified: true, positionSource: "公式", permissionConfirmed: true,
          });
          expect(ready).toMatchObject({ lat: 34.3 });
          expect(await store.setPublished(actor, s!.id, true)).toMatchObject({ published: true });
          await store.setPublished(actor, s!.id, true);
          const rows = await tx.select().from(auditLog).where(eq(auditLog.targetId, s!.id));
          expect(rows.filter((r) => r.action === "spot.publish")).toHaveLength(1);
          const summary = (await store.listRoutes()).find((r) => r.id === list[3]!.id)!;
          expect(summary.publishedSpotCount).toBe(1);
          expect(summary.spotCount).toBeGreaterThan(1);
        });
      });
    });

    test("reordering places renumbers them and the course rally together; wrong id sets are refused", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const list = await store.listRoutes();
          const found = await store.getRoute(list[3]!.id);
          const ids = found!.spots.map((s) => s.id);
          const reversed = [...ids].reverse();
          expect(await store.reorderSpots(actor, list[3]!.id, reversed)).toBe(true);
          const after = await store.getRoute(list[3]!.id);
          expect(after!.spots.map((s) => s.id)).toEqual(reversed);
          expect(await store.reorderSpots(actor, list[3]!.id, ids.slice(1))).toBe(false);
          const routeIds = list.map((r) => r.id);
          expect(await store.reorderRoutes(actor, [...routeIds].reverse())).toBe(true);
          expect((await store.listRoutes())[0]!.id).toBe(routeIds.at(-1)!);
          expect(await store.reorderRoutes(actor, routeIds.slice(1))).toBe(false);
        });
      });
    });

    test("another kind of point stays out of the rallies; changing the kind moves it; a stamped place cannot stop being one", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const list = await store.listRoutes();
          const course3 = list[2]!; // no mounds yet
          const toilet = await store.createSpot(actor, course3.id, { nameJa: "トイレ", kind: "toilet" });
          expect(toilet).toMatchObject({ kind: "toilet" });
          expect(await tx.select().from(rallySpots).where(eq(rallySpots.spotId, toilet!.id))).toHaveLength(0);

          const asStamp = await store.updateSpot(actor, toilet!.id, toilet!.updatedAt, { kind: "stamp" });
          expect(asStamp).toMatchObject({ kind: "stamp" });
          expect(await tx.select().from(rallySpots).where(eq(rallySpots.spotId, toilet!.id))).toHaveLength(1);

          const stamped = asStamp as { updatedAt: Date };
          const visitor = (await tx.insert(users).values({}).returning({ id: users.id }))[0]!;
          await tx.insert(stamps).values({ userId: visitor.id, spotId: toilet!.id });
          expect(await store.updateSpot(actor, toilet!.id, stamped.updatedAt, { kind: "turn" })).toBe("has_stamps");
        });
      });
    });

    test("the lists count stamp places and other points apart; a point other than a stamp place can be published without permission, a stamp place cannot", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const list = await store.listRoutes();
          const route = list[2]!;
          const verified = { lat: 34.3, lng: 135.1, positionVerified: true, positionSource: "公式" };
          const turn = await store.createSpot(actor, route.id, { nameJa: "分かれ道", kind: "turn", ...verified });
          expect(await store.setPublished(actor, turn!.id, true)).toMatchObject({ published: true });
          const stamp = await store.createSpot(actor, route.id, { nameJa: "経塚", kind: "stamp", ...verified });
          await expect(
            (async () => {
              await tx.transaction(async (t) => {
                await createDrizzleContentStore(t as unknown as typeof db).setPublished(actor, stamp!.id, true);
              });
            })(),
          ).rejects.toThrow(); // the database still demands permission for a stamp place
          const row = (await store.listRoutes()).find((r) => r.id === route.id)!;
          expect([row.spotCount, row.publishedSpotCount, row.pointCount]).toEqual([1, 0, 1]);
        });
      });
    });

    test("history, access and photo round-trip", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const [r] = await store.listRoutes();
          const saved = await store.updateRoute(actor, r!.id, r!.updatedAt, { historyJa: "歴史", accessEn: "By train", photoUrl: "https://example.com/a.jpg" });
          expect(saved).toMatchObject({ historyJa: "歴史", historyEn: null, accessEn: "By train", photoUrl: "https://example.com/a.jpg" });
        });
      });
    });

    test("a route line round-trips as GeoJSON", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const [r] = await store.listRoutes();
          const line = { type: "LineString" as const, coordinates: [[135, 34], [135.01, 34.01, 120]] as [number, number, number?][] };
          const saved = await store.updateRoute(actor, r!.id, r!.updatedAt, { geometry: line, distanceKm: 1.5 });
          expect(saved).toMatchObject({ geometry: line, distanceKm: 1.5 });
          expect((await store.getRoute(r!.id))!.route.geometry).toEqual(line);
        });
      });
    });
  });
});
