import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { afterCursor, newestFirst, sameInstant } from "../admin-lists/list-sql";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { furiganaWords } from "../db/schema";
import { FURIGANA_AUDIT, type FuriganaStore } from "./furigana-words";

const UNIQUE_VIOLATION = "23505";
const isUniqueViolation = (err: unknown) => (err as { code?: string; cause?: { code?: string } })?.code === UNIQUE_VIOLATION || (err as { cause?: { code?: string } })?.cause?.code === UNIQUE_VIOLATION;

export function createDrizzleFuriganaStore(db: Db): FuriganaStore {
  return {
    list: (cursor, limit) =>
      db
        .select()
        .from(furiganaWords)
        .where(and(eq(furiganaWords.pending, false), afterCursor(furiganaWords.createdAt, furiganaWords.id, cursor)))
        .orderBy(...newestFirst(furiganaWords.createdAt, furiganaWords.id))
        .limit(limit),
    async get(id) {
      const [row] = await db.select().from(furiganaWords).where(eq(furiganaWords.id, id)).limit(1);
      return row ?? null;
    },
    async create(actor, fields) {
      return db.transaction(async (tx) => {
        const [made] = await tx.insert(furiganaWords).values(fields).returning();
        await writeAudit(tx, { actorUserId: actor, action: FURIGANA_AUDIT.create, targetId: made!.id });
        return made!;
      });
    },
    async update(actor, id, expected, changes) {
      try {
        return await db.transaction(async (tx) => {
          const [row] = await tx
            .update(furiganaWords)
            // A suggestion changed in the form is a person's word from now on.
            .set({ ...changes, pending: false, updatedAt: sql`clock_timestamp()` })
            .where(and(eq(furiganaWords.id, id), sameInstant(furiganaWords.updatedAt, expected)))
            .returning();
          if (!row) {
            const [exists] = await tx.select({ id: furiganaWords.id }).from(furiganaWords).where(eq(furiganaWords.id, id)).limit(1);
            return exists ? ("conflict" as const) : null;
          }
          await writeAudit(tx, { actorUserId: actor, action: FURIGANA_AUDIT.update, targetId: id });
          return row;
        });
      } catch (err) {
        // The word was changed into one that is already in the list.
        if (isUniqueViolation(err)) return "conflict";
        throw err;
      }
    },
    async remove(actor, id) {
      return db.transaction(async (tx) => {
        const [gone] = await tx.delete(furiganaWords).where(eq(furiganaWords.id, id)).returning({ id: furiganaWords.id });
        if (!gone) return false;
        await writeAudit(tx, { actorUserId: actor, action: FURIGANA_AUDIT.delete, targetId: id });
        return true;
      });
    },
    all: () => db.select({ word: furiganaWords.word, reading: furiganaWords.reading }).from(furiganaWords).where(eq(furiganaWords.pending, false)),
    pending: () => db.select().from(furiganaWords).where(eq(furiganaWords.pending, true)).orderBy(asc(furiganaWords.word)),
    async approve(actor, ids) {
      if (ids.length === 0) return 0;
      return db.transaction(async (tx) => {
        const done = await tx
          .update(furiganaWords)
          .set({ pending: false, updatedAt: sql`clock_timestamp()` })
          .where(and(inArray(furiganaWords.id, ids), eq(furiganaWords.pending, true)))
          .returning({ id: furiganaWords.id });
        for (const { id } of done) await writeAudit(tx, { actorUserId: actor, action: FURIGANA_AUDIT.approve, targetId: id });
        return done.length;
      });
    },
    async setSuggestions(actor, words) {
      return db.transaction(async (tx) => {
        const wanted = words.map((w) => w.word);
        const gone = await tx
          .delete(furiganaWords)
          .where(and(eq(furiganaWords.pending, true), wanted.length ? notInArray(furiganaWords.word, wanted) : sql`true`))
          .returning({ id: furiganaWords.id });
        // A word already in the list, a person's or a suggestion, stays as it is.
        const made = words.length
          ? await tx.insert(furiganaWords).values(words.map((w) => ({ ...w, pending: true }))).onConflictDoNothing({ target: furiganaWords.word }).returning({ id: furiganaWords.id })
          : [];
        await writeAudit(tx, { actorUserId: actor, action: FURIGANA_AUDIT.refresh, targetId: null });
        return { added: made.length, removed: gone.length };
      });
    },
    async findByWord(word) {
      const [row] = await db.select().from(furiganaWords).where(eq(furiganaWords.word, word)).limit(1);
      return row ?? null;
    },
  };
}
