// Runs the real Drizzle stores against a real PostgreSQL. Skipped unless TEST_DATABASE_URL is set:
//   TEST_DATABASE_URL=postgres://user:pass@localhost:5432/ktrg bun test src/db/integration.test.ts
// The database must already be migrated (bun run db:migrate). Every row it creates is tagged and
// removed afterwards, and it refuses to run against anything but localhost or a "test" database.
import { afterAll, describe, expect, test } from "bun:test";
import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, like, sql } from "drizzle-orm";
import { createDrizzleAuditWriter, writeAudit } from "../audit/audit-store";
import { createDrizzleOtpStore } from "../auth/otp-store";
import { createDrizzleContentStore } from "../content/content-store";
import { createDrizzleMeStore } from "../me/me-store";
import { createDrizzlePasskeyStore } from "../auth/passkey-store";
import { createDrizzleRateLimitStore } from "../auth/rate-limit-store";
import { createDrizzleSessionStore } from "../auth/session-store";
import { createDb } from "./client";
import { listRalliesWithProgress, ralliesForPlace, recordFinished } from "../rallies/rally-store";
import { createDrizzleRallyAdminStore } from "../rallies/rally-admin-store";
import { createDrizzleStampListStore } from "../stamps/stamp-list";
import { createDrizzleStampStore } from "../stamps/stamp-store";
import { createDrizzleNoticeStore } from "../notices/notice-store";
import { createDrizzleBannerStore } from "../banners/banner-store";
import { createDrizzlePlaceStore } from "../places/place-store";
import { createDrizzleSiteSettingsStore } from "../site-settings/site-settings-store";
import { createDrizzlePostStore } from "../posts/post-store";
import { createDrizzleCommentStore } from "../posts/comment-store";
import { createDrizzleAuthorStore } from "../posts/author-store";
import { createDrizzleSitePageStore } from "../pages/site-page-store";
import { createDrizzleUserListStore } from "../users/user-list";
import {
  auditLog,
  banners,
  blogAuthors,
  blogComments,
  sitePages,
  bannerTranslations,
  courseCompletions,
  otpCodes,
  places,
  placeTranslations,
  rallies,
  rallyCompletions,
  rallyRoutes,
  rallySpots,
  rallyTranslations,
  rateLimits,
  routes,
  routeTranslations,
  sessions,
  siteSettings,
  spots,
  spotTranslations,
  stamps,
  trailNotices,
  blogPosts,
  blogPostTranslations,
  trailNoticeTranslations,
  users,
  webauthnChallenges,
} from "./schema";
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

    test("promoteToAdmin: an account whose role an admin has set is not promoted", async () => {
      const user = await otp.findOrCreateUser(email("otp-demoted"));
      try {
        await db.insert(auditLog).values({ actorUserId: null, action: "user.role.change", targetType: "user", targetId: user.id });
        expect(await otp.promoteToAdmin(user.id)).toBe(false);
        const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, user.id));
        expect(row!.role).toBe("participant");
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
      expect(found?.user).toEqual({ ...user, restricted: false });
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
      await otp.insert({ email: old.email!, codeHash: "e".repeat(64), expiresAt: future() });
      await otp.insert({ email: fresh.email!, codeHash: "f".repeat(64), expiresAt: future() });
      try {
        expect(await me.purgeDue(new Date("2026-03-01T00:00:00Z"))).toBe(1);
        // Their login codes go with them (kept by email, so no foreign key reaches them).
        expect(await otp.latest(old.email!)).toBeNull();
        expect(await otp.latest(fresh.email!)).not.toBeNull();
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

  /** Every name in a translation table, keyed "ownerId:locale". */
  async function nameOf<T extends typeof routeTranslations | typeof spotTranslations | typeof rallyTranslations>(
    tx: Tx,
    table: T,
    ownerOf: (row: T["$inferSelect"]) => string,
  ) {
    const rows = (await tx.select().from(table as typeof routeTranslations)) as T["$inferSelect"][];
    return new Map(rows.map((r) => [`${ownerOf(r)}:${r.locale}`, r.name]));
  }

  test("fills an empty database: 20 rallies, 19 routes in order, 31 draft spots on their courses, 50 links", async () => {
    await inRollback(async (tx) => {
      expect(await seed(tx)).toEqual({ rallies: 20, routes: 19, spots: 31, links: 50 });

      expect(await tx.select().from(rallies)).toHaveLength(20);
      // The seeded places are the sutra mounds: waypoints with a stamp.
      expect((await tx.select({ k: spots.kind, s: spots.stampable }).from(spots)).every((x) => x.k === "mound" && x.s)).toBe(true);
      const rs = await tx.select().from(routes).orderBy(asc(routes.sortOrder));
      const routeNames = await nameOf(tx, routeTranslations, (t) => t.routeId);
      expect(rs.map((r) => routeNames.get(`${r.id}:ja`))).toEqual(SEED_ROUTES.map((r) => r.nameJa));
      expect(rs.map((r) => routeNames.get(`${r.id}:en`))).toEqual(SEED_ROUTES.map((r) => r.nameEn));
      expect(rs.map((r) => r.sortOrder)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));

      const ss = await tx.select().from(spots);
      expect(ss).toHaveLength(31);
      const spotNames = await nameOf(tx, spotTranslations, (t) => t.spotId);
      const idOfCourse = (n: number) => rs[n - 1]!.id;
      for (const s of ss) {
        expect(s.lat).toBeNull(); // coordinates are never guessed
        expect(s.lng).toBeNull();
        expect(s.published).toBe(false);
        expect(s.permissionConfirmed).toBe(false);
        const wanted = SEED_SPOTS.find((x) => x.nameJa === spotNames.get(`${s.id}:ja`))!;
        expect(spotNames.get(`${s.id}:en`)).toBe(wanted.nameEn);
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
      expect(await tx.select().from(rallySpots)).toHaveLength(31);
      expect(await tx.select().from(rallyRoutes)).toHaveLength(19);
    });
  });

  test("it never overwrites what was edited in the CMS", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      await tx.update(routes).set({ videoUrl: "https://youtu.be/x" }).where(eq(routes.sortOrder, 1));
      const [edited] = await tx.select().from(routes).where(eq(routes.sortOrder, 1));
      await tx
        .update(routeTranslations)
        .set({ name: "編集済み" })
        .where(and(eq(routeTranslations.routeId, edited!.id), eq(routeTranslations.locale, "ja")));

      await seed(tx);

      const [first] = await tx.select().from(routes).where(eq(routes.sortOrder, 1));
      expect(first).toMatchObject({ videoUrl: "https://youtu.be/x" });
      expect((await nameOf(tx, routeTranslations, (t) => t.routeId)).get(`${first!.id}:ja`)).toBe("編集済み");
    });
  });

  test("the sutra-mound rally is a rally of places holding all 31; each course gets a rally of courses holding it; all published", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      const rs = await tx.select().from(routes).orderBy(asc(routes.sortOrder));
      const rl = await tx.select().from(rallies);
      expect(rl.every((r) => r.published)).toBe(true);
      const ofPlaces = rl.filter((r) => r.kind === "places");
      expect(ofPlaces).toHaveLength(1);
      expect((await nameOf(tx, rallyTranslations, (t) => t.rallyId)).get(`${ofPlaces[0]!.id}:ja`)).toBe("経塚スタンプラリー");
      const placeLinks = await tx.select().from(rallySpots);
      expect(placeLinks.filter((l) => l.rallyId === ofPlaces[0]!.id)).toHaveLength(31);

      const ofCourses = rl.filter((r) => r.kind === "course");
      expect(ofCourses).toHaveLength(19);
      const courseLinks = await tx.select().from(rallyRoutes);
      expect(courseLinks).toHaveLength(19);
      expect(new Set(courseLinks.map((l) => l.routeId))).toEqual(new Set(rs.map((r) => r.id)));
      // A rally of courses lists courses, never places.
      expect(placeLinks.filter((l) => ofCourses.some((c) => c.id === l.rallyId))).toHaveLength(0);
    });
  });

  test("the links are foreign keys: no link to a missing rally, place or course, and no link twice", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      const refused = async (body: (t: Tx) => Promise<unknown>) => {
        await expect(
          (async () => {
            await tx.transaction(async (t) => {
              await body(t);
            });
          })(),
        ).rejects.toThrow();
      };
      const missing = "00000000-0000-4000-8000-000000000000";
      const [placeLink] = await tx.select().from(rallySpots).limit(1);
      const [courseLink] = await tx.select().from(rallyRoutes).limit(1);
      await refused((t) => t.insert(rallySpots).values({ rallyId: placeLink!.rallyId, spotId: placeLink!.spotId }));
      await refused((t) => t.insert(rallySpots).values({ rallyId: placeLink!.rallyId, spotId: missing }));
      await refused((t) => t.insert(rallySpots).values({ rallyId: missing, spotId: placeLink!.spotId }));
      await refused((t) => t.insert(rallyRoutes).values({ rallyId: courseLink!.rallyId, routeId: courseLink!.routeId }));
      await refused((t) => t.insert(rallyRoutes).values({ rallyId: courseLink!.rallyId, routeId: missing }));
      await refused((t) => t.insert(courseCompletions).values({ userId: missing, routeId: courseLink!.routeId }));
      await refused((t) => t.insert(rallyCompletions).values({ userId: missing, rallyId: courseLink!.rallyId }));
    });
  });

  test("deleting a rally removes its links and its finishes, never places, stamps or course finishes", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      const [rally] = await tx.select().from(rallies).where(eq(rallies.kind, "course")).limit(1);
      const [link] = await tx.select().from(rallyRoutes).where(eq(rallyRoutes.rallyId, rally!.id));
      const [visitor] = await tx.insert(users).values({}).returning({ id: users.id });
      await tx.insert(courseCompletions).values({ userId: visitor!.id, routeId: link!.routeId });
      await tx.insert(rallyCompletions).values({ userId: visitor!.id, rallyId: rally!.id });
      await tx.delete(rallies).where(eq(rallies.id, rally!.id));
      expect(await tx.select().from(rallyRoutes).where(eq(rallyRoutes.rallyId, rally!.id))).toHaveLength(0);
      expect(await tx.select().from(rallyCompletions).where(eq(rallyCompletions.userId, visitor!.id))).toHaveLength(0);
      expect(await tx.select().from(courseCompletions).where(eq(courseCompletions.userId, visitor!.id))).toHaveLength(1);
      expect(await tx.select().from(spots)).toHaveLength(31);
    });
  });

  test("ONE stamp on a sutra mound is found in its course, every rally of places listing it, and every rally of courses holding its course", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      const rs = await tx.select().from(routes).orderBy(asc(routes.sortOrder));
      const course4 = rs[3]!.id;
      const onCourse4 = await tx.select().from(spots).where(eq(spots.routeId, course4)).orderBy(asc(spots.sortOrder));
      const [a, b] = onCourse4 as [(typeof onCourse4)[number], (typeof onCourse4)[number]];
      const ready = { lat: 34.3, lng: 135.1, permissionConfirmed: true, positionVerified: true, published: true };
      await tx.update(spots).set(ready).where(inArray(spots.id, [a.id, b.id]));
      const [mounds] = await tx.select({ id: rallies.id }).from(rallies).where(eq(rallies.kind, "places"));
      const [course4Rally] = await tx.select({ id: rallyRoutes.rallyId }).from(rallyRoutes).where(eq(rallyRoutes.routeId, course4));

      // A second rally of places that also lists mound a, and a bigger rally of courses holding course 4 and course 11.
      const [extra] = await tx.insert(rallies).values({ kind: "places", published: true }).returning({ id: rallies.id });
      await tx.insert(rallySpots).values({ rallyId: extra!.id, spotId: a.id, position: 1 });
      const [big] = await tx.insert(rallies).values({ kind: "course", published: true }).returning({ id: rallies.id });
      await tx.insert(rallyRoutes).values([
        { rallyId: big!.id, routeId: course4, position: 1 },
        { rallyId: big!.id, routeId: rs[10]!.id, position: 2 },
      ]);

      const found = await ralliesForPlace(tx, a.id);
      expect(found.routeId).toBe(course4);
      expect(new Set(found.rallyIds)).toEqual(new Set([mounds!.id, extra!.id, course4Rally!.id, big!.id]));

      const [me] = await tx.insert(users).values({}).returning({ id: users.id });
      const [other] = await tx.insert(users).values({}).returning({ id: users.id });
      await tx.insert(stamps).values([
        { userId: me!.id, spotId: a.id },
        { userId: other!.id, spotId: a.id },
      ]);
      // One of the two mounds of course 4: only the second rally of places (just mound a) is finished.
      expect(await recordFinished(tx, me!.id, { spotId: a.id })).toEqual({ routeIds: [], rallyIds: [extra!.id] });

      await tx.insert(stamps).values({ userId: me!.id, spotId: b.id });
      const second = await recordFinished(tx, me!.id, { spotId: b.id });
      // Course 4 is finished, so its rally of courses is, and so is the mound rally (only a and b are published).
      // The big rally still waits for course 11, whose mounds are drafts: it cannot be finished yet.
      expect(second.routeIds).toEqual([course4]);
      expect(new Set(second.rallyIds)).toEqual(new Set([course4Rally!.id, mounds!.id]));
      expect(await recordFinished(tx, me!.id)).toEqual({ routeIds: [], rallyIds: [] });

      const mine = await listRalliesWithProgress(tx, me!.id);
      expect(mine.find((r) => r.id === big!.id)).toMatchObject({ kind: "course", progress: { total: 2, finished: 1, complete: false }, completedAt: null });
      expect(mine.find((r) => r.id === mounds!.id)).toMatchObject({ kind: "places", progress: { total: 2, stamped: 2, complete: true } });
      expect(mine.find((r) => r.id === mounds!.id)!.completedAt).toBeInstanceOf(Date);
      // The other visitor's stamp is theirs only.
      expect((await listRalliesWithProgress(tx, other!.id)).find((r) => r.id === mounds!.id)).toMatchObject({ progress: { stamped: 1 }, completedAt: null });
    });
  });

  test("stamp store: one stamp per visitor and place, finishes saved in the same step, revoke hides it and is audited", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      const store = createDrizzleStampStore(tx as unknown as typeof db);
      const [route] = await tx.select().from(routes).orderBy(asc(routes.sortOrder)).offset(3).limit(1);
      const [a, b] = await tx.select().from(spots).where(eq(spots.routeId, route!.id)).orderBy(asc(spots.sortOrder));
      await tx.update(spots).set({ lat: 34.3, lng: 135.1, permissionConfirmed: true, positionVerified: true, published: true }).where(inArray(spots.id, [a!.id, b!.id]));
      const [me] = await tx.insert(users).values({}).returning({ id: users.id });
      const [admin] = await tx.insert(users).values({ role: "admin" }).returning({ id: users.id });
      const clean = { flagged: false, flagReason: null };

      expect(await store.findSpot(a!.id)).toMatchObject({ id: a!.id, published: true, stampable: true, positionVerified: true, lat: 34.3, lng: 135.1, status: "open" });
      expect(await store.findSpot(randomUUID())).toBeNull();

      const first = await store.award(me!.id, a!.id, { flagged: true, flagReason: "low_accuracy" });
      expect(first).toMatchObject({ created: true, flagged: true });
      expect(first.finished.routeIds).toEqual([]); // one of the course's two mounds

      // The same place again changes nothing, and does not turn the first stamp's flag off.
      const again = await store.award(me!.id, a!.id, clean);
      expect(again).toMatchObject({ created: false, flagged: true, finished: { routeIds: [], rallyIds: [] } });
      expect(again.createdAt).toEqual(first.createdAt);
      expect(await tx.select().from(stamps).where(eq(stamps.userId, me!.id))).toHaveLength(1);

      // The second mound finishes the course (and the rallies that need it) in the same step.
      const second = await store.award(me!.id, b!.id, clean);
      expect(second.finished.routeIds).toEqual([route!.id]);
      expect(second.finished.rallyIds.length).toBeGreaterThanOrEqual(2);
      expect(await tx.select().from(courseCompletions).where(eq(courseCompletions.userId, me!.id))).toHaveLength(1);

      expect((await store.listMine(me!.id)).map((s) => s.spotId).sort()).toEqual([a!.id, b!.id].sort());
      expect((await store.listMine(me!.id)).every((s) => s.routeId === route!.id)).toBe(true); // the course each stamp belongs to
      // The admin list: newest first, member number and place name, no user id or email.
      const rows = await createDrizzleStampListStore(tx as unknown as typeof db).list(null, 10);
      const queued = rows.find((r) => r.flagged)!;
      expect(rows).toHaveLength(2);
      expect(queued).toMatchObject({ flagReason: "low_accuracy", revoked: false, memberId: expect.any(String), spotName: expect.any(String) });
      expect(queued.spotName).not.toBe(""); // the place's Japanese name, joined in
      expect(JSON.stringify(rows)).not.toContain(me!.id);

      expect(await store.setRevoked(admin!.id, queued!.id, true)).toBe("ok");
      expect((await store.listMine(me!.id)).map((s) => s.spotId)).toEqual([b!.id]);
      expect((await createDrizzleStampListStore(tx as unknown as typeof db).get(queued.id))!.revoked).toBe(true);
      // The course and rally finishes that stamp earned are taken back with it.
      expect(await tx.select().from(courseCompletions).where(eq(courseCompletions.userId, me!.id))).toHaveLength(0);
      expect(await tx.select().from(rallyCompletions).where(eq(rallyCompletions.userId, me!.id))).toHaveLength(0);
      expect(await store.setRevoked(admin!.id, queued!.id, false)).toBe("ok");
      expect(await store.listMine(me!.id)).toHaveLength(2);
      expect(await store.setRevoked(admin!.id, randomUUID(), true)).toBe("not_found");
      // Revoked, a stamp blocks a new one and says so; revoking twice keeps the first time and writes one audit row.
      expect(await store.setRevoked(admin!.id, queued!.id, true)).toBe("ok");
      const [firstRevoke] = await tx.select({ at: stamps.revokedAt }).from(stamps).where(eq(stamps.id, queued!.id));
      expect(await store.award(me!.id, a!.id, clean)).toMatchObject({ created: false, revoked: true });
      expect(await store.setRevoked(admin!.id, queued!.id, true)).toBe("ok");
      expect((await tx.select({ at: stamps.revokedAt }).from(stamps).where(eq(stamps.id, queued!.id)))[0]!.at).toEqual(firstRevoke!.at);
      expect(await store.setRevoked(admin!.id, queued!.id, false)).toBe("ok");
      const audits = await tx.select().from(auditLog).where(eq(auditLog.actorUserId, admin!.id));
      expect(audits.map((r) => [r.action, r.targetId])).toEqual([["stamp.revoke", queued!.id], ["stamp.restore", queued!.id], ["stamp.revoke", queued!.id], ["stamp.restore", queued!.id]]);
    });
  });

  test("a saved course finish stays when the course gets another place later", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      const rs = await tx.select().from(routes).orderBy(asc(routes.sortOrder));
      const course4 = rs[3]!.id;
      const ready = { lat: 34.3, lng: 135.1, permissionConfirmed: true, positionVerified: true, published: true };
      const onCourse4 = await tx.select({ id: spots.id }).from(spots).where(eq(spots.routeId, course4));
      await tx.update(spots).set(ready).where(inArray(spots.id, onCourse4.map((s) => s.id)));
      const [me] = await tx.insert(users).values({}).returning({ id: users.id });
      await tx.insert(stamps).values(onCourse4.map((s) => ({ userId: me!.id, spotId: s.id })));
      expect((await recordFinished(tx, me!.id)).routeIds).toEqual([course4]);

      // A new published stamp place on course 4 that I have not visited.
      const [added] = await tx.insert(spots).values({ routeId: course4, sortOrder: 99, ...ready }).returning({ id: spots.id });
      await tx.insert(spotTranslations).values({ spotId: added!.id, locale: "ja", name: "新しい場所" });
      const [course4Rally] = await tx.select({ id: rallyRoutes.rallyId }).from(rallyRoutes).where(eq(rallyRoutes.routeId, course4));
      const after = (await listRalliesWithProgress(tx, me!.id)).find((r) => r.id === course4Rally!.id)!;
      expect(after).toMatchObject({ progress: { finished: 1, complete: true } });
      expect(await tx.select().from(courseCompletions).where(eq(courseCompletions.userId, me!.id))).toHaveLength(1);
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

    test("the English video is kept in the route's English translation row, apart from the Japanese video, and can be cleared", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const [first] = await store.listRoutes();
          const a = (await store.updateRoute(actor, first!.id, first!.updatedAt, { videoUrl: "https://youtu.be/dQw4w9WgXcQ", videoUrlEn: "https://youtu.be/abcdefghijk" })) as { updatedAt: Date };
          expect(a).toMatchObject({ videoUrl: "https://youtu.be/dQw4w9WgXcQ", videoUrlEn: "https://youtu.be/abcdefghijk" });
          expect((await store.getRoute(first!.id))?.route).toMatchObject({ videoUrl: "https://youtu.be/dQw4w9WgXcQ", videoUrlEn: "https://youtu.be/abcdefghijk" });
          const withSubs = (await store.updateRoute(actor, first!.id, a.updatedAt, { videoSubtitlesEn: true })) as { updatedAt: Date };
          expect(withSubs).toMatchObject({ videoSubtitlesEn: true, videoSubtitles: false, videoUrlEn: "https://youtu.be/abcdefghijk" });
          expect((await store.getRoute(first!.id))?.route.videoSubtitlesEn).toBe(true);
          const cleared = await store.updateRoute(actor, first!.id, withSubs.updatedAt, { videoUrlEn: null });
          expect(cleared).toMatchObject({ videoUrl: "https://youtu.be/dQw4w9WgXcQ", videoUrlEn: null });
        });
      });
    });

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

    test("the history of a route holds what was done to it and to its places, and nothing about other routes", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const [first, second] = await store.listRoutes();
          const made = await store.createSpot(actor, first!.id, { nameJa: "履歴の場所" });
          await store.updateRoute(actor, first!.id, first!.updatedAt, { nameEn: "Changed" });
          await store.updateRoute(actor, second!.id, second!.updatedAt, { nameEn: "Elsewhere" });
          const history = await store.routeHistory(first!.id, 50);
          // (inside one rolled-back transaction every row has the same time, so the order is not asserted here)
          expect(history.map((h) => h.action).sort()).toEqual(["route.update", "spot.create"]);
          expect(history.every((h) => h.actorUserId === actor)).toBe(true);
          expect(history.find((h) => h.action === "spot.create")!.targetId).toBe(made!.id);
        });
      });
    });

    test("a video link that is replaced or removed goes to the route's video history, once each", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const [route] = await store.listRoutes();
          const A = "https://www.youtube.com/watch?v=aaaaaaaaaaa";
          const B = "https://www.youtube.com/watch?v=bbbbbbbbbbb";
          let at = route!.updatedAt;
          for (const url of [A, B, A, null]) {
            const r = await store.updateRoute(actor, route!.id, at, { videoUrl: url });
            if (r === null || r === "conflict") throw new Error("not saved");
            at = r.updatedAt;
          }
          // (inside one rolled-back transaction every row has the same time, so the order is not asserted here)
          expect((await store.videoHistory(route!.id, 10)).sort()).toEqual([A, B].sort());
        });
      });
    });

    test("creating a place puts it on its course (and so in its course's rallies) but in no rally of places; it is audited", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const list = await store.listRoutes();
          const course3 = list[2]!; // the seed gives course 3 no mounds
          const s = await store.createSpot(actor, course3.id, { nameJa: "新しい場所" });
          expect(s).toMatchObject({ published: false, positionVerified: false, sortOrder: 1, routeId: course3.id });
          expect(await tx.select().from(rallySpots).where(eq(rallySpots.spotId, s!.id))).toHaveLength(0);
          expect((await ralliesForPlace(tx, s!.id)).rallyIds.length).toBeGreaterThan(0); // course 3's rally of courses
          const rows = await tx.select().from(auditLog).where(eq(auditLog.targetId, s!.id));
          expect(rows.map((r) => r.action)).toEqual(["spot.create"]);
          expect(rows[0]!.actorUserId).toBe(actor);
        });
      });
    });

    test("deleting: a route with places is refused; an empty one leaves its rallies of courses (they stay); a stamped place is refused", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const list = await store.listRoutes();
          expect(await store.deleteRoute(actor, list[3]!.id)).toBe("has_places");
          const [link] = await tx.select().from(rallyRoutes).where(eq(rallyRoutes.routeId, list[2]!.id));
          expect(await store.deleteRoute(actor, list[2]!.id)).toBe("ok");
          expect(await tx.select().from(rallyRoutes).where(eq(rallyRoutes.routeId, list[2]!.id))).toHaveLength(0);
          expect(await tx.select().from(rallies).where(eq(rallies.id, link!.rallyId))).toHaveLength(1);

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

    test("a waypoint whose stamp switch goes off leaves every rally of places; a stamped one cannot switch off", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const list = await store.listRoutes();
          const course3 = list[2]!; // no mounds yet
          const place = await store.createSpot(actor, course3.id, { nameJa: "経塚かもしれない場所", stampable: true });
          const [mounds] = await tx.select({ id: rallies.id }).from(rallies).where(eq(rallies.kind, "places"));
          await tx.insert(rallySpots).values({ rallyId: mounds!.id, spotId: place!.id, position: 99 });

          const asToilet = await store.updateSpot(actor, place!.id, place!.updatedAt, { kind: "toilet", stampable: false });
          expect(asToilet).toMatchObject({ kind: "toilet", stampable: false });
          expect(await tx.select().from(rallySpots).where(eq(rallySpots.spotId, place!.id))).toHaveLength(0);

          // Switched on again: it counts in its course again (no link needed), but does not rejoin the rally of places.
          const asStamp = await store.updateSpot(actor, place!.id, (asToilet as { updatedAt: Date }).updatedAt, { stampable: true });
          expect(asStamp).toMatchObject({ stampable: true });
          expect(await tx.select().from(rallySpots).where(eq(rallySpots.spotId, place!.id))).toHaveLength(0);

          const stamped = asStamp as { updatedAt: Date };
          const visitor = (await tx.insert(users).values({}).returning({ id: users.id }))[0]!;
          await tx.insert(stamps).values({ userId: visitor.id, spotId: place!.id });
          expect(await store.updateSpot(actor, place!.id, stamped.updatedAt, { stampable: false })).toBe("has_stamps");
        });
      });
    });

    test("the lists count waypoints with and without a stamp apart; every place needs the permission to be published, with a stamp or without", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const list = await store.listRoutes();
          const route = list[2]!;
          const verified = { lat: 34.3, lng: 135.1, positionVerified: true, positionSource: "公式" };
          const turn = await store.createSpot(actor, route.id, { nameJa: "分かれ道", kind: "turn", permissionConfirmed: true, ...verified });
          expect(await store.setPublished(actor, turn!.id, true)).toMatchObject({ published: true });
          // A place without a stamp has a page too: without the permission it stays a draft as well.
          const toilet = await store.createSpot(actor, route.id, { nameJa: "トイレ", kind: "toilet", ...verified });
          expect(await store.setPublished(actor, toilet!.id, true)).toMatchObject({ published: false });
          const stamp = await store.createSpot(actor, route.id, { nameJa: "経塚", kind: "mound", stampable: true, ...verified });
          // The write itself refuses a stamp place without permission: it stays a draft (no error, nothing recorded).
          expect(await store.setPublished(actor, stamp!.id, true)).toMatchObject({ published: false });
          // The database constraint is the backstop if that condition were ever dropped.
          await expect(
            (async () => {
              await tx.transaction(async (t) => {
                await t.update(spots).set({ published: true }).where(eq(spots.id, stamp!.id));
              });
            })(),
          ).rejects.toThrow();
          const row = (await store.listRoutes()).find((r) => r.id === route.id)!;
          expect([row.spotCount, row.publishedSpotCount, row.pointCount]).toEqual([1, 0, 2]);
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

    test("words live in one row per language: changing English leaves Japanese alone, and a place's words go with it", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const [r] = await store.listRoutes();
          expect(r).toMatchObject({ nameJa: SEED_ROUTES[0]!.nameJa, nameEn: SEED_ROUTES[0]!.nameEn, historyJa: null });
          const saved = await store.updateRoute(actor, r!.id, r!.updatedAt, { nameEn: "Renamed", descriptionEn: null });
          expect(saved).toMatchObject({ nameJa: SEED_ROUTES[0]!.nameJa, nameEn: "Renamed", descriptionEn: null });
          const rows = await tx.select().from(routeTranslations).where(eq(routeTranslations.routeId, r!.id));
          expect(rows.map((t) => t.locale).sort()).toEqual(["en", "ja"]);

          const s = await store.createSpot(actor, r!.id, { nameJa: "新しい場所", statusNoteEn: "Closed for repairs" });
          expect(s).toMatchObject({ nameJa: "新しい場所", nameEn: null, statusNoteEn: "Closed for repairs", statusNoteJa: null });
          expect(await store.getSpot(s!.id)).toMatchObject({ statusNoteEn: "Closed for repairs" });
          await store.deleteSpot(actor, s!.id);
          expect(await tx.select().from(spotTranslations).where(eq(spotTranslations.spotId, s!.id))).toHaveLength(0);
        });
      });
    });

    test("the database refuses a Japanese row without a name; an English one may lack it", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const route = await store.createRoute(actor, { nameJa: "新しいコース" });
          await expect(
            (async () => {
              await tx.transaction(async (t) => {
                await t.update(routeTranslations).set({ name: null }).where(eq(routeTranslations.routeId, route.id));
              });
            })(),
          ).rejects.toThrow();
          await tx.insert(routeTranslations).values({ routeId: route.id, locale: "en", history: "Only a history" });
          expect((await store.getRoute(route.id))!.route).toMatchObject({ nameJa: "新しいコース", nameEn: null, historyEn: "Only a history" });
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

  describe("rally admin store", () => {
    async function withAdmin(tx: Tx, body: (store: ReturnType<typeof createDrizzleRallyAdminStore>, actor: string) => Promise<void>) {
      await seed(tx);
      const [u] = await tx.insert(users).values({ role: "admin" }).returning({ id: users.id });
      await body(createDrizzleRallyAdminStore(tx as unknown as typeof db), u!.id);
    }

    test("lists the seeded rallies; a rally of places shows its places in order, a rally of courses its courses", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store) => {
          const list = await store.listRallies();
          expect(list).toHaveLength(20);
          const mounds = list.find((r) => r.kind === "places")!;
          expect(mounds).toMatchObject({ memberCount: 31, published: true, completionCount: 0 });
          expect(list.filter((r) => r.kind === "course").every((r) => r.memberCount === 1)).toBe(true);
          expect(await store.candidatePlaces()).toHaveLength(31);
          const courses = await store.candidateCourses();
          expect(courses).toHaveLength(19);
          expect(courses.reduce((n, c) => n + c.stampPlaceCount, 0)).toBe(31);

          const read = await store.getRally(mounds.id);
          if (!read || !("places" in read)) throw new Error("expected a rally of places");
          expect(read.places.map((p) => p.position)).toEqual(read.places.map((_, i) => i + 1));
          const aCourse = list.find((r) => r.kind === "course")!;
          const courseRead = await store.getRally(aCourse.id);
          if (!courseRead || !("courses" in courseRead)) throw new Error("expected a rally of courses");
          expect(courseRead.courses).toHaveLength(1);
          expect(await store.getRally("00000000-0000-4000-8000-000000000000")).toBeNull();
        });
      });
    });

    test("a new rally comes with all its ticked members in one go, as a draft at the end, with one audit row", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const routeIds = (await store.candidateCourses()).slice(0, 5).map((c) => c.routeId).reverse();
          const made = await store.createRally(actor, { kind: "course", nameJa: "和歌山のコース", nameEn: null, memberIds: routeIds });
          expect(made).toMatchObject({ kind: "course", published: false, memberCount: 5, sortOrder: 20 }); // the seed numbers rallies 0 to 19
          const links = await tx.select().from(rallyRoutes).where(eq(rallyRoutes.rallyId, made.id)).orderBy(asc(rallyRoutes.position));
          expect(links.map((l) => [l.routeId, l.position])).toEqual(routeIds.map((id, i) => [id, i + 1]));

          const spotIds = (await store.candidatePlaces()).slice(0, 3).map((p) => p.spotId);
          const ofPlaces = await store.createRally(actor, { kind: "places", nameJa: "三つの経塚", nameEn: "Three", memberIds: spotIds });
          expect(ofPlaces).toMatchObject({ kind: "places", memberCount: 3, nameEn: "Three" });
          const rows = await tx.select().from(auditLog).where(inArray(auditLog.targetId, [made.id, ofPlaces.id]));
          expect(rows.map((r) => r.action)).toEqual(["rally.create", "rally.create"]);
        });
      });
    });

    test("an update saves names and publishing (two audit rows), and a stale updatedAt is a conflict", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const [first] = await store.listRallies();
          const saved = await store.updateRally(actor, first!.id, first!.updatedAt, { nameJa: "新しい名前", nameEn: "New", published: false });
          expect(saved).toMatchObject({ nameJa: "新しい名前", nameEn: "New", published: false });
          expect(await store.updateRally(actor, first!.id, first!.updatedAt, { nameEn: "Again" })).toBe("conflict");
          expect(await store.updateRally(actor, "00000000-0000-4000-8000-000000000000", new Date(), {})).toBeNull();
          const words = await tx.select().from(rallyTranslations).where(eq(rallyTranslations.rallyId, first!.id));
          expect(new Map(words.map((w) => [w.locale, w.name]))).toEqual(new Map([["ja", "新しい名前"], ["en", "New"]]));
          const rows = await tx.select().from(auditLog).where(eq(auditLog.targetId, first!.id));
          expect(rows.map((r) => r.action).sort()).toEqual(["rally.unpublish", "rally.update"]);
        });
      });
    });

    test("members are replaced in order (places or courses), a stale copy is a conflict, and stamps are never touched", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const list = await store.listRallies();
          const mounds = list.find((r) => r.kind === "places")!;
          const picks = (await store.candidatePlaces()).slice(0, 3).map((c) => c.spotId).reverse();
          const [visitor] = await tx.insert(users).values({}).returning({ id: users.id });
          await tx.insert(stamps).values({ userId: visitor!.id, spotId: picks[2]! });
          expect(await store.setPlaces(actor, mounds.id, mounds.updatedAt, picks)).toMatchObject({ memberCount: 3 });
          const read = await store.getRally(mounds.id);
          if (!read || !("places" in read)) throw new Error("expected a rally of places");
          expect(read.places.map((p) => [p.spotId, p.position])).toEqual(picks.map((id, i) => [id, i + 1]));
          expect(await store.setPlaces(actor, mounds.id, mounds.updatedAt, [])).toBe("conflict");
          expect(await tx.select().from(stamps).where(eq(stamps.userId, visitor!.id))).toHaveLength(1);

          const course = list.find((r) => r.kind === "course")!;
          const two = (await store.candidateCourses()).slice(0, 2).map((c) => c.routeId);
          expect(await store.setCourses(actor, course.id, course.updatedAt, two)).toMatchObject({ memberCount: 2 });
        });
      });
    });

    test("the visitors' list is built in a few queries and agrees with the admin's view: published places only, courses with their stamp places and status", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store) => {
          await tx.execute(sql`update spots set lat = 34.3, lng = 135.1, position_verified = true, position_source = 'test', permission_confirmed = true, published = true where id in (select id from spots order by sort_order limit 5)`);
          await tx.execute(sql`update spots set status = 'closed' where id = (select id from spots where published order by id limit 1)`);
          const list = await store.publicRallies();
          expect(list).toHaveLength(20);
          const mounds = list.find((r) => r.kind === "places")!;
          const admin = await store.getRally(mounds.id);
          if (!admin || !("places" in admin)) throw new Error("expected a rally of places");
          expect(mounds.places.map((p) => p.id)).toEqual(admin.places.filter((p) => p.published).map((p) => p.spotId));
          expect(mounds.places.length).toBeGreaterThan(0);
          expect(mounds.courses).toEqual([]);
          const withStamps = list.filter((r) => r.kind === "course").flatMap((r) => r.courses.flatMap((c) => c.spots));
          expect(withStamps.length).toBeGreaterThan(0);
          expect(withStamps.filter((s) => s.status === "closed")).toHaveLength(1);
          expect(list.every((r) => (r.kind === "places" ? r.courses.length === 0 : r.places.length === 0))).toBe(true);
        });
      });
    });

    test("changing the way a rally is made swaps its members in one step, keeps visitors' finishes, and is recorded", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const list = await store.listRallies();
          const mounds = list.find((r) => r.kind === "places")!;
          const [visitor] = await tx.insert(users).values({}).returning({ id: users.id });
          await tx.insert(rallyCompletions).values({ userId: visitor!.id, rallyId: mounds.id });
          const courses = (await store.candidateCourses()).slice(0, 2).map((c) => c.routeId);
          const changed = await store.changeKind(actor, mounds.id, mounds.updatedAt, "course", courses);
          expect(changed).toMatchObject({ kind: "course", memberCount: 2, completionCount: 1 });
          const read = await store.getRally(mounds.id);
          if (!read || !("courses" in read)) throw new Error("expected a rally of courses");
          expect(read.courses.map((c) => [c.routeId, c.position])).toEqual(courses.map((id, i) => [id, i + 1]));
          expect(await tx.select().from(rallySpots).where(eq(rallySpots.rallyId, mounds.id))).toHaveLength(0);
          expect(await store.changeKind(actor, mounds.id, mounds.updatedAt, "places", [])).toBe("conflict"); // the old copy
          const back = (await store.getRally(mounds.id))!.rally;
          const places = (await store.candidatePlaces()).slice(0, 3).map((p) => p.spotId);
          expect(await store.changeKind(actor, mounds.id, back.updatedAt, "places", places)).toMatchObject({ kind: "places", memberCount: 3 });
          expect(await tx.select().from(rallyRoutes).where(eq(rallyRoutes.rallyId, mounds.id))).toHaveLength(0);
          expect(await tx.select().from(auditLog).where(eq(auditLog.action, "rally.kind.change"))).toHaveLength(2);
        });
      });
    });

    test("reordering takes every rally; deleting takes its links and finishes, and is recorded", async () => {
      await inRollback(async (tx) => {
        await withAdmin(tx, async (store, actor) => {
          const list = await store.listRallies();
          const reversed = list.map((r) => r.id).reverse();
          expect(await store.reorderRallies(actor, reversed)).toBe(true);
          expect((await store.listRallies()).map((r) => r.id)).toEqual(reversed);
          expect(await store.reorderRallies(actor, reversed.slice(1))).toBe(false);

          const mounds = list.find((r) => r.kind === "places")!;
          const [visitor] = await tx.insert(users).values({}).returning({ id: users.id });
          await tx.insert(rallyCompletions).values({ userId: visitor!.id, rallyId: mounds.id });
          expect((await store.listRallies()).find((r) => r.id === mounds.id)!.completionCount).toBe(1);
          expect(await store.deleteRally(actor, mounds.id)).toBe("ok");
          expect(await tx.select().from(rallySpots).where(eq(rallySpots.rallyId, mounds.id))).toHaveLength(0);
          expect(await tx.select().from(rallyCompletions).where(eq(rallyCompletions.rallyId, mounds.id))).toHaveLength(0);
          expect(await store.deleteRally(actor, mounds.id)).toBe("not_found");
          const rows = await tx.select().from(auditLog).where(eq(auditLog.targetId, mounds.id));
          expect(rows.map((r) => r.action)).toEqual(["rally.delete"]);
        });
      });
    });
  });
});

describe.skipIf(!url)("trail notices on real PostgreSQL", () => {
  const { db, client } = connect();
  const store = createDrizzleNoticeStore(db);
  const otp = createDrizzleOtpStore(db);
  const tag = `nt${randomUUID().slice(0, 8)}`;
  const made: string[] = [];
  const fields = (over: Record<string, unknown> = {}) => ({
    routeId: null,
    titleJa: `${tag} 通行止め`,
    titleEn: null,
    bodyJa: "本文",
    bodyEn: "Text",
    sourceUrl: "https://example.com/",
    sourceNameJa: "出典",
    sourceNameEn: null,
    verifiedOn: "2026-10-20",
    expiresOn: null,
    published: false,
    ...over,
  });

  afterAll(async () => {
    if (made.length) {
      await db.delete(auditLog).where(inArray(auditLog.targetId, made));
      await db.delete(trailNotices).where(inArray(trailNotices.id, made));
    }
    await db.delete(users).where(like(users.email, `${tag}-%`));
    await client.end();
  });

  test("words go to the translation table and come back flat; a stale save is a conflict; delete takes the words", async () => {
    const actor = (await otp.findOrCreateUser(`${tag}-admin@example.test`)).id;
    const row = await store.create(actor, fields());
    made.push(row.id);
    expect(row).toMatchObject({ titleJa: `${tag} 通行止め`, bodyEn: "Text", verifiedOn: "2026-10-20", expiresOn: null, published: false });
    const words = await db.select().from(trailNoticeTranslations).where(eq(trailNoticeTranslations.trailNoticeId, row.id));
    expect(words.map((w) => w.locale).sort()).toEqual(["en", "ja"]);

    const changed = await store.update(actor, row.id, row.updatedAt, { titleEn: "Closed", published: true, expiresOn: "2026-10-31" });
    expect(changed).toMatchObject({ titleEn: "Closed", titleJa: `${tag} 通行止め`, published: true, expiresOn: "2026-10-31" });
    expect(await store.update(actor, row.id, row.updatedAt, { titleJa: "late" })).toBe("conflict");
    expect(await store.update(actor, randomUUID(), row.updatedAt, { titleJa: "x" })).toBeNull();

    expect(await store.remove(actor, row.id)).toBe(true);
    expect(await db.select().from(trailNoticeTranslations).where(eq(trailNoticeTranslations.trailNoticeId, row.id))).toHaveLength(0);
    expect((await db.select().from(auditLog).where(eq(auditLog.targetId, row.id))).map((a) => a.action)).toEqual(["notice.create", "notice.update", "notice.delete"]);
  });

  test("another language is saved as its own row (content_locale) and read back into translations", async () => {
    const actor = (await otp.findOrCreateUser(`${tag}-admin@example.test`)).id;
    const row = await store.create(actor, { ...fields(), translations: { de: { title: "Gesperrt" } } });
    made.push(row.id);
    expect(row.translations).toEqual({ de: { title: "Gesperrt" } });
    const words = await db.select().from(trailNoticeTranslations).where(eq(trailNoticeTranslations.trailNoticeId, row.id));
    expect(words.map((w) => w.locale).sort()).toEqual(["de", "en", "ja"]);
    const changed = await store.update(actor, row.id, row.updatedAt, { translations: { de: { title: null }, th: { body: "ปิด" } } });
    expect(changed !== "conflict" && changed?.translations).toEqual({ th: { body: "ปิด" } });
  });

  test("the Japanese title is required by the database too", async () => {
    const actor = (await otp.findOrCreateUser(`${tag}-admin@example.test`)).id;
    await expect(store.create(actor, fields({ titleJa: null as unknown as string }))).rejects.toThrow();
  });

  test("pages newest first without gaps, and visitors see only published notices still in date", async () => {
    const actor = (await otp.findOrCreateUser(`${tag}-admin@example.test`)).id;
    for (const [i, over] of [
      { published: true, expiresOn: "2026-10-19" },
      { published: true, expiresOn: "2026-10-20" },
      { published: false },
      { published: true, expiresOn: null },
    ].entries()) {
      made.push((await store.create(actor, fields({ titleJa: `${tag} ${i}`, ...over }))).id);
    }
    const mine = (rows: { titleJa: string }[]) => rows.map((r) => r.titleJa).filter((t) => t.startsWith(tag));
    const all: string[] = [];
    let after = null as { createdAt: Date; id: string } | null;
    for (;;) {
      const page = await store.list(after, 2);
      all.push(...mine(page));
      if (page.length < 2) break;
      after = { createdAt: page[1]!.createdAt, id: page[1]!.id };
    }
    expect(all.slice(0, 4)).toEqual([`${tag} 3`, `${tag} 2`, `${tag} 1`, `${tag} 0`]);
    expect(mine(await store.listPublic("2026-10-20")).sort()).toEqual([`${tag} 1`, `${tag} 3`]);
  });
});

describe.skipIf(!url)("banners and role changes on real PostgreSQL", () => {
  const { db, client } = connect();
  const otp = createDrizzleOtpStore(db);
  const sessionStore = createDrizzleSessionStore(db);
  const bannerStore = createDrizzleBannerStore(db);
  const userStore = createDrizzleUserListStore(db);
  const tag = `bu${randomUUID().slice(0, 8)}`;
  const made: string[] = [];

  afterAll(async () => {
    if (made.length) {
      await db.delete(auditLog).where(inArray(auditLog.targetId, made));
      await db.delete(banners).where(inArray(banners.id, made));
    }
    const ids = (await db.select({ id: users.id }).from(users).where(like(users.email, `${tag}-%`))).map((u) => u.id);
    if (ids.length) await db.delete(auditLog).where(inArray(auditLog.targetId, ids));
    await db.delete(users).where(like(users.email, `${tag}-%`));
    await client.end();
  });

  test("banners: words saved per language, visitors get published ones in order, delete takes the words", async () => {
    const actor = (await otp.findOrCreateUser(`${tag}-admin@example.test`)).id;
    const add = async (altJa: string, sortOrder: number, published: boolean) => {
      const row = await bannerStore.create(actor, { imageUrl: "https://example.com/a.jpg", altJa, altEn: null, sortOrder, published });
      made.push(row.id);
      return row;
    };
    const late = await add(`${tag} 二`, 2, true);
    await add(`${tag} 下書き`, 0, false);
    const first = await add(`${tag} 一`, 1, true);
    expect(first).toMatchObject({ altJa: `${tag} 一`, altEn: null });
    expect((await bannerStore.listPublic()).map((b) => b.altJa).filter((a) => a.startsWith(tag))).toEqual([`${tag} 一`, `${tag} 二`]);

    const changed = await bannerStore.update(actor, late.id, late.updatedAt, { altEn: "Two" });
    expect(changed).toMatchObject({ altJa: `${tag} 二`, altEn: "Two" });
    expect(await bannerStore.update(actor, late.id, late.updatedAt, { altEn: "late" })).toBe("conflict");
    expect(await bannerStore.remove(actor, late.id)).toBe(true);
    expect(await db.select().from(bannerTranslations).where(eq(bannerTranslations.bannerId, late.id))).toHaveLength(0);
  });

  test("a role change sets the role, ends that account's sessions (not others'), and writes one audit row", async () => {
    const admin = await otp.findOrCreateUser(`${tag}-admin@example.test`);
    const target = await otp.findOrCreateUser(`${tag}-target@example.test`);
    const at = new Date();
    for (const userId of [admin.id, target.id]) {
      await sessionStore.create({ userId, tokenHash: randomUUID(), expiresAt: new Date(at.getTime() + 60_000), absoluteExpiresAt: new Date(at.getTime() + 60_000), now: at });
    }
    const before = (await userStore.get(target.id))!;
    const changed = await userStore.setRole(admin.id, target.id, before.updatedAt, "admin");
    expect(changed).toMatchObject({ id: target.id, role: "admin" });
    expect(await db.select().from(sessions).where(eq(sessions.userId, target.id))).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.userId, admin.id))).toHaveLength(1);
    const audits = await db.select().from(auditLog).where(eq(auditLog.targetId, target.id));
    expect(audits.map((a) => [a.action, a.actorUserId])).toEqual([["user.role.change", admin.id]]);
    expect(await userStore.setRole(admin.id, target.id, before.updatedAt, "participant")).toBe("conflict");
  });
});

describe.skipIf(!url)("places directory on real PostgreSQL", () => {
  const { db, client } = connect();
  const otp = createDrizzleOtpStore(db);
  const store = createDrizzlePlaceStore(db);
  const tag = `pl${randomUUID().slice(0, 8)}`;
  const made: string[] = [];

  afterAll(async () => {
    if (made.length) {
      await db.delete(auditLog).where(inArray(auditLog.targetId, made));
      await db.delete(places).where(inArray(places.id, made));
    }
    const ids = (await db.select({ id: users.id }).from(users).where(like(users.email, `${tag}-%`))).map((u) => u.id);
    if (ids.length) await db.delete(auditLog).where(inArray(auditLog.targetId, ids));
    await db.delete(users).where(like(users.email, `${tag}-%`));
    await client.end();
  });

  const blank = {
    category: "cafe" as const, routeId: null, nearSpotId: null, openingHours: null, nameJa: "", nameEn: null, descriptionJa: null, descriptionEn: null, hoursJa: null, hoursEn: null, closedDaysJa: null, closedDaysEn: null,
    lat: null, lng: null, positionVerified: false, positionSource: null, addressJa: null, addressEn: null, phone: null, website: null, photoUrl: null, status: "unknown" as const,
    lastVerified: null, listingConfirmed: false, listingNote: null, published: false,
  };

  test("words saved per language, a change checks for a newer save, visitors get only published places, delete takes the words", async () => {
    const actor = (await otp.findOrCreateUser(`${tag}-admin@example.test`)).id;
    const add = async (nameJa: string, over: Record<string, unknown> = {}) => {
      const row = await store.create(actor, { ...blank, nameJa, hoursJa: "9時～17時", hoursEn: "9:00 - 17:00", ...over });
      made.push(row.id);
      return row;
    };
    const live = await add(`${tag} 公開`, { lat: 34.2, lng: 135.1, positionVerified: true, positionSource: "地図アプリ", listingConfirmed: true, published: true, lastVerified: "2026-10-17" });
    await add(`${tag} 下書き`);
    expect(live).toMatchObject({ nameJa: `${tag} 公開`, nameEn: null, hoursEn: "9:00 - 17:00", lastVerified: "2026-10-17" });
    // The address is a word like the name: one per language, in the translation table.
    const withAddress = await store.update(actor, live.id, live.updatedAt, { addressJa: "奈良県御所市", addressEn: "Gose, Nara" });
    expect(withAddress).toMatchObject({ addressJa: "奈良県御所市", addressEn: "Gose, Nara" });
    live.updatedAt = (withAddress as { updatedAt: Date }).updatedAt;
    expect((await store.listPublic()).map((p) => p.nameJa).filter((n) => n.startsWith(tag))).toEqual([`${tag} 公開`]);

    const changed = await store.update(actor, live.id, live.updatedAt, { nameEn: "Open", closedDaysJa: "月" });
    expect(changed).toMatchObject({ nameEn: "Open", closedDaysJa: "月", hoursJa: "9時～17時" });
    expect(await store.update(actor, live.id, live.updatedAt, { nameEn: "late" })).toBe("conflict");
    // The database itself refuses to publish a place that was never checked.
    await expect((async () => db.update(places).set({ published: true, positionVerified: false }).where(eq(places.id, live.id)))()).rejects.toThrow();
    expect(await store.remove(actor, live.id)).toBe(true);
    expect(await db.select().from(placeTranslations).where(eq(placeTranslations.placeId, live.id))).toHaveLength(0);
  });
});

describe.skipIf(!url)("site settings on real PostgreSQL", () => {
  const { db, client } = connect();
  const otp = createDrizzleOtpStore(db);
  const store = createDrizzleSiteSettingsStore(db);
  const tag = `ss${randomUUID().slice(0, 8)}`;

  afterAll(async () => {
    await db.delete(siteSettings).where(eq(siteSettings.key, "map_style"));
    const ids = (await db.select({ id: users.id }).from(users).where(like(users.email, `${tag}-%`))).map((u) => u.id);
    if (ids.length) await db.delete(auditLog).where(inArray(auditLog.actorUserId, ids));
    await db.delete(users).where(like(users.email, `${tag}-%`));
    await client.end();
  });

  test("a value is saved, then replaced (one row), and each change is audited", async () => {
    const actor = (await otp.findOrCreateUser(`${tag}-admin@example.test`)).id;
    await db.delete(siteSettings).where(eq(siteSettings.key, "map_style"));
    expect(await store.get("map_style")).toBeNull();
    await store.set(actor, "map_style", { base: "pale" });
    await store.set(actor, "map_style", { base: "photo" });
    expect(await store.get("map_style")).toEqual({ base: "photo" });
    expect(await db.select().from(siteSettings).where(eq(siteSettings.key, "map_style"))).toHaveLength(1);
    const audits = await db.select().from(auditLog).where(eq(auditLog.actorUserId, actor));
    expect(audits.map((a) => a.action)).toEqual(["site_setting.update", "site_setting.update"]);
  });
});

describe.skipIf(!url)("blog posts on real PostgreSQL", () => {
  const { db, client } = connect();
  const store = createDrizzlePostStore(db);
  const otp = createDrizzleOtpStore(db);
  const tag = `bp${randomUUID().slice(0, 8)}`;
  const made: string[] = [];
  const fields = (over: Record<string, unknown> = {}) => ({
    titleJa: `${tag} 金剛山の秋`,
    titleEn: null,
    bodyJa: "本文",
    bodyEn: "Text",
    authorNameJa: "山田",
    authorNameEn: null,
    coverPhotoUrl: null,
    coverCredit: null,
    authorPhotoUrl: null, placeId: null, routeId: null, spotId: null, authorId: null,
    publishedOn: "2026-10-20",
    published: false,
    ...over,
  });

  afterAll(async () => {
    if (made.length) {
      await db.delete(auditLog).where(inArray(auditLog.targetId, made));
      await db.delete(blogPosts).where(inArray(blogPosts.id, made));
    }
    await db.delete(users).where(like(users.email, `${tag}-%`));
    await client.end();
  });

  const add = async (actor: string, over: Record<string, unknown> = {}) => {
    const row = await store.create(actor, fields(over));
    made.push(row.id);
    return row;
  };

  test("words go to the translation table and come back flat; a stale save is a conflict; delete takes the words", async () => {
    const actor = (await otp.findOrCreateUser(`${tag}-admin@example.test`)).id;
    const row = await add(actor);
    expect(row).toMatchObject({ titleJa: `${tag} 金剛山の秋`, bodyEn: "Text", authorNameJa: "山田", publishedOn: "2026-10-20", published: false });
    const words = await db.select().from(blogPostTranslations).where(eq(blogPostTranslations.blogPostId, row.id));
    expect(words.map((w) => w.locale).sort()).toEqual(["en", "ja"]);

    const changed = await store.update(actor, row.id, row.updatedAt, { titleEn: "Autumn", published: true });
    expect(changed).toMatchObject({ titleEn: "Autumn", titleJa: `${tag} 金剛山の秋`, published: true });
    expect(await store.update(actor, row.id, row.updatedAt, { titleJa: "late" })).toBe("conflict");
    expect(await store.update(actor, randomUUID(), row.updatedAt, { titleJa: "x" })).toBeNull();

    expect(await store.remove(actor, row.id)).toBe(true);
    expect(await db.select().from(blogPostTranslations).where(eq(blogPostTranslations.blogPostId, row.id))).toHaveLength(0);
    expect((await db.select().from(auditLog).where(eq(auditLog.targetId, row.id))).map((a) => a.action)).toEqual(["post.create", "post.update", "post.delete"]);
  });

  test("the Japanese title and body are required by the database too", async () => {
    const actor = (await otp.findOrCreateUser(`${tag}-admin@example.test`)).id;
    await expect(store.create(actor, fields({ titleJa: null as unknown as string }))).rejects.toThrow();
    await expect(store.create(actor, fields({ bodyJa: null as unknown as string }))).rejects.toThrow();
  });

  test("visitors see published posts whose day has come, newest day first; one post by id follows the same rule", async () => {
    const actor = (await otp.findOrCreateUser(`${tag}-admin@example.test`)).id;
    const today = "2026-10-21";
    await add(actor, { titleJa: `${tag} 下書き`, published: false, publishedOn: "2026-10-19" });
    await add(actor, { titleJa: `${tag} 明日`, published: true, publishedOn: "2026-10-22" });
    const older = await add(actor, { titleJa: `${tag} 19日`, published: true, publishedOn: "2026-10-19" });
    const newer = await add(actor, { titleJa: `${tag} 今日`, published: true, publishedOn: today });

    const mine = (rows: { titleJa: string }[]) => rows.map((r) => r.titleJa).filter((t) => t.startsWith(tag));
    expect(mine(await store.listPublic(today))).toEqual([`${tag} 今日`, `${tag} 19日`]);

    expect((await store.getPublic(newer.id, today))?.titleJa).toBe(`${tag} 今日`);
    expect(await store.getPublic(older.id, "2026-10-18")).toBeNull(); // dated after that day
    expect(await store.getPublic(randomUUID(), today)).toBeNull();
  });
});

describe.skipIf(!url)("blog comments, writers and pages on real PostgreSQL", () => {
  const { db, client } = connect();
  const otp = createDrizzleOtpStore(db);
  const posts = createDrizzlePostStore(db);
  const comments = createDrizzleCommentStore(db);
  const authors = createDrizzleAuthorStore(db);
  const pages = createDrizzleSitePageStore(db);
  const tag = `cm${randomUUID().slice(0, 8)}`;
  const postIds: string[] = [];
  const authorIds: string[] = [];
  const pageIds: string[] = [];

  afterAll(async () => {
    const all = [...postIds, ...authorIds, ...pageIds];
    if (all.length) await db.delete(auditLog).where(inArray(auditLog.targetId, all));
    if (postIds.length) await db.delete(blogPosts).where(inArray(blogPosts.id, postIds));
    if (authorIds.length) await db.delete(blogAuthors).where(inArray(blogAuthors.id, authorIds));
    if (pageIds.length) await db.delete(sitePages).where(inArray(sitePages.id, pageIds));
    await db.delete(users).where(like(users.email, `${tag}-%`));
    await client.end();
  });

  const post = async (actor: string, over: Record<string, unknown> = {}) => {
    const row = await posts.create(actor, {
      titleJa: `${tag} 記事`, titleEn: null, bodyJa: "本文", bodyEn: null, authorNameJa: null, authorNameEn: null, coverPhotoUrl: null, coverCredit: null,
      authorPhotoUrl: null, placeId: null, routeId: null, spotId: null, authorId: null, publishedOn: "2026-10-20", published: true, ...over,
    });
    postIds.push(row.id);
    return row;
  };

  test("a comment is held until approved, shows the writer's profile name, and goes with the account", async () => {
    const editor = (await otp.findOrCreateUser(`${tag}-editor@example.test`)).id;
    const writer = (await otp.findOrCreateUser(`${tag}-writer@example.test`)).id;
    await db.update(users).set({ displayName: "山田" }).where(eq(users.id, writer));
    const p = await post(editor);

    const held = await comments.create(writer, p.id, "良い道でした", "pending");
    expect(held).toMatchObject({ postId: p.id, status: "pending", authorName: "山田", postTitle: `${tag} 記事` });
    expect(await comments.listApproved(p.id, 10)).toHaveLength(0);

    const approved = await comments.setStatus(editor, held.id, held.updatedAt, "approved");
    expect(approved).toMatchObject({ status: "approved" });
    expect(await comments.setStatus(editor, held.id, held.updatedAt, "hidden")).toBe("conflict"); // a stale copy
    expect(await comments.setStatus(editor, randomUUID(), held.updatedAt, "hidden")).toBeNull();
    expect((await comments.listApproved(p.id, 10)).map((c) => c.body)).toEqual(["良い道でした"]);

    // Deleting the account takes its comments with it.
    await db.delete(users).where(eq(users.id, writer));
    expect(await db.select().from(blogComments).where(eq(blogComments.postId, p.id))).toHaveLength(0);
    // Removing a comment by hand works once.
    const other = (await otp.findOrCreateUser(`${tag}-other@example.test`)).id;
    const second = await comments.create(other, p.id, "もう一つ", "approved");
    expect(await comments.remove(editor, second.id)).toBe(true);
    expect(await comments.remove(editor, second.id)).toBe(false);
  });

  test("a post shows the picked writer, else the account's profile name, else nothing", async () => {
    const editor = (await otp.findOrCreateUser(`${tag}-byline@example.test`)).id;
    await db.update(users).set({ displayName: "編集者" }).where(eq(users.id, editor));
    const writer = await authors.create(editor, { nameJa: `${tag} 筆者`, nameEn: "Writer", photoUrl: null });
    authorIds.push(writer.id);
    const byWriter = await post(editor, { authorId: writer.id });
    const byAccount = await post(editor);
    expect(await posts.getPublic(byWriter.id, "2026-10-21")).toMatchObject({ writer: { nameJa: `${tag} 筆者`, nameEn: "Writer" } });
    expect(await posts.getPublic(byAccount.id, "2026-10-21")).toMatchObject({ writer: null, accountName: "編集者" });

    // A writer who is deleted leaves the post, and the post falls back to the account.
    expect(await authors.remove(editor, writer.id)).toBe(true);
    expect(await posts.getPublic(byWriter.id, "2026-10-21")).toMatchObject({ writer: null, accountName: "編集者" });
  });

  test("a page's address is unique; taking another page's address is a conflict, and delete removes it", async () => {
    const editor = (await otp.findOrCreateUser(`${tag}-pages@example.test`)).id;
    const make = async (slug: string) => {
      const row = await pages.create(editor, { slug, titleJa: `${tag} ${slug}`, titleEn: null, bodyJa: "本文", bodyEn: null, published: true });
      pageIds.push(row.id);
      return row;
    };
    const a = await make(`${tag}-a`);
    const b = await make(`${tag}-b`);
    await expect(make(`${tag}-a`)).rejects.toThrow(); // the database holds the address unique
    expect(await pages.update(editor, b.id, b.updatedAt, { slug: a.slug })).toBe("conflict");
    expect(await pages.update(editor, b.id, b.updatedAt, { titleEn: "B" })).toMatchObject({ titleEn: "B" });
    expect(await pages.remove(editor, a.id)).toBe(true);
    expect(await pages.get(a.id)).toBeNull();
  });
});
