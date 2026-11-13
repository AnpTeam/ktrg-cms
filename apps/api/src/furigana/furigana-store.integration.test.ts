// The furigana store on a real PostgreSQL, with the sizes the hourly refresh can reach. Skipped unless TEST_DATABASE_URL is
// set (see db/integration.test.ts); each test runs in a transaction that is always rolled back.
import { afterAll, describe, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { createDb } from "../db/client";
import { auditLog, furiganaWords, users } from "../db/schema";
import { createDrizzleFuriganaStore } from "./furigana-store";
import { FURIGANA_AUDIT } from "./furigana-words";

const url = process.env.TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  const safe = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname) || /test/i.test(parsed.pathname);
  if (!safe) throw new Error(`Refusing to run integration tests against ${parsed.hostname}: use localhost or a *test* database.`);
}

describe.skipIf(!url)("furigana store at the sizes of a real refresh", () => {
  const { db, client } = url ? createDb(url) : ({ db: undefined, client: undefined } as unknown as ReturnType<typeof createDb>);
  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
  class Rollback extends Error {}
  afterAll(async () => {
    await client?.end();
  });

  async function inRollback(body: (tx: Tx, actor: string) => Promise<void>) {
    let failure: unknown;
    await db
      .transaction(async (tx) => {
        try {
          await tx.delete(furiganaWords);
          const [u] = await tx.insert(users).values({ role: "admin" }).returning({ id: users.id });
          await body(tx, u!.id);
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

  const many = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ word: `語${from + i}`, reading: `ご${from + i}` }));

  test("a refresh with more words than one statement can carry (PostgreSQL allows 65,535 values) adds them all, and the next one drops the stale ones", async () => {
    await inRollback(async (tx, actor) => {
      const store = createDrizzleFuriganaStore(tx as unknown as typeof db);
      const first = await store.setSuggestions(actor, many(25_000));
      expect(first).toEqual({ added: 25_000, removed: 0 });
      expect(await store.pending()).toHaveLength(25_000);
      // 5,000 of them stay, 20,000 are gone from the dictionary's list, 3,000 are new.
      const second = await store.setSuggestions(actor, [...many(5_000), ...many(3_000, 30_000)]);
      expect(second).toEqual({ added: 3_000, removed: 20_000 });
      expect(await store.pending()).toHaveLength(8_000);
    });
  }, 60_000);

  test("approving many words audits every one of them", async () => {
    await inRollback(async (tx, actor) => {
      const store = createDrizzleFuriganaStore(tx as unknown as typeof db);
      await store.setSuggestions(actor, many(500));
      const ids = (await store.pending()).map((w) => w.id);
      expect(await store.approve(actor, ids)).toBe(500);
      const rows = await tx.select({ id: auditLog.id }).from(auditLog).where(inArray(auditLog.targetId, ids));
      expect(rows).toHaveLength(500);
      expect((await tx.select({ action: auditLog.action }).from(auditLog).where(eq(auditLog.targetId, ids[0]!)))[0]!.action).toBe(FURIGANA_AUDIT.approve);
      expect(await store.pending()).toHaveLength(0);
    });
  });
});
