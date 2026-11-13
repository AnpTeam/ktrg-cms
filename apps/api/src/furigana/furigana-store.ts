import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { afterCursor, newestFirst, sameInstant } from "../admin-lists/list-sql";
import { auditRow } from "../audit/audit-log";
import { writeAudit } from "../audit/audit-store";
import type { Db } from "../db/client";
import { auditLog, furiganaWords } from "../db/schema";
import { FURIGANA_AUDIT, type FuriganaStore } from "./furigana-words";

// PostgreSQL carries at most 65,535 values in one statement, and the dictionary may suggest every word on the site: long lists
// are written in parts of this size.
const CHUNK = 1000;
const inParts = <T>(items: readonly T[]): T[][] => Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) => items.slice(i * CHUNK, (i + 1) * CHUNK));

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
        if (done.length > 0) await tx.insert(auditLog).values(done.map(({ id }) => auditRow({ actorUserId: actor, action: FURIGANA_AUDIT.approve, targetId: id }))); // one statement, not one per word
        return done.length;
      });
    },
    async setSuggestions(actor, words) {
      return db.transaction(async (tx) => {
        // The waiting suggestions the dictionary no longer makes. Found here, not with `not in (every wanted word)`, which would
        // carry every word as a value.
        const wanted = new Set(words.map((w) => w.word));
        const waiting = await tx.select({ id: furiganaWords.id, word: furiganaWords.word }).from(furiganaWords).where(eq(furiganaWords.pending, true));
        const stale = waiting.filter((w) => !wanted.has(w.word)).map((w) => w.id);
        for (const part of inParts(stale)) await tx.delete(furiganaWords).where(inArray(furiganaWords.id, part));
        // A word already in the list, a person's or a suggestion, stays as it is.
        let added = 0;
        for (const part of inParts(words)) {
          const made = await tx.insert(furiganaWords).values(part.map((w) => ({ ...w, pending: true }))).onConflictDoNothing({ target: furiganaWords.word }).returning({ id: furiganaWords.id });
          added += made.length;
        }
        await writeAudit(tx, { actorUserId: actor, action: FURIGANA_AUDIT.refresh, targetId: null });
        return { added, removed: stale.length };
      });
    },
    async findByWord(word) {
      const [row] = await db.select().from(furiganaWords).where(eq(furiganaWords.word, word)).limit(1);
      return row ?? null;
    },
  };
}
