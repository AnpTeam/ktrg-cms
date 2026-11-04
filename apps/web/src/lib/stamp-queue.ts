// The offline stamp queue (Phase B, slice B2; see docs/phase-b-offline-plan.md).
//
// A stamp pressed with no signal is written here with the position read at the press, and sent when the app is online
// again. The SERVER still decides (distance, accuracy, closed, rate limit): the queue only carries the request. Nothing
// here keeps a credential, and a row is deleted as soon as the server has given a definite answer (the row holds
// coordinates, which CLAUDE.md says must not outlive the upload).
//
// The logic is pure over a small store interface so it is unit-tested without a browser; `createIdbQueueStore` is the
// IndexedDB one (browser only), `createMemoryQueueStore` the test twin.

import { openDB } from "idb";
import type { Reading, StampFailure, StampResult } from "./stamp-flow";

/** A queued stamp this old is dropped on the phone without asking (the server refuses it after 48 h anyway). */
export const MAX_QUEUE_AGE_MS = 48 * 60 * 60 * 1000;
/** After this many attempts that failed for an unknown reason (a server error), the row is given up on. */
export const MAX_TRIES = 5;

export interface QueuedStamp {
  /** Random id, the row's own key (also what a Web Lock names). */
  id: string;
  /** Whose stamp: the account's user id, or "guest". A row never uploads under another key. */
  userKey: string;
  spotId: string;
  lat: number;
  lng: number;
  accuracyM: number;
  /** ISO time the phone pressed the stamp. */
  scannedAt: string;
  tries: number;
}

export interface QueueStore {
  add(row: QueuedStamp): Promise<void>;
  /** The rows of one user key, oldest first. */
  list(userKey: string): Promise<QueuedStamp[]>;
  remove(id: string): Promise<void>;
  update(id: string, patch: Partial<Pick<QueuedStamp, "tries">>): Promise<void>;
}

export function newQueuedStamp(userKey: string, spotId: string, reading: Reading, now: Date, id: string = crypto.randomUUID()): QueuedStamp {
  return { id, userKey, spotId, lat: reading.lat, lng: reading.lng, accuracyM: reading.accuracyM, scannedAt: now.toISOString(), tries: 0 };
}

/** Answers that mean "not now, try again later": the row stays and the rest of the queue waits too. */
const RETRY_LATER: ReadonlySet<StampFailure> = new Set(["network", "too_many_requests", "login_needed"]);

export type Outcome =
  | { kind: "accepted"; row: QueuedStamp; already: boolean }
  /** The server (or the age rule) said no for good: the row is gone, and the visitor should be told why once. */
  | { kind: "rejected"; row: QueuedStamp; failure: StampFailure | "expired" };

export interface FlushResult {
  outcomes: Outcome[];
  /** Rows still waiting afterwards. */
  left: number;
  /** True when the upload stopped early because it must wait (no signal, rate limited, signed out). */
  waiting: boolean;
}

/**
 * Sends the rows of `userKey`, oldest first. `send` does one request and never throws. Stops at the first answer that
 * means "later" (so a dropped signal does not burn every row's tries); a definite answer removes the row; an unknown
 * failure keeps it up to MAX_TRIES times.
 */
export async function flushQueue(opts: {
  store: QueueStore;
  userKey: string;
  send: (row: QueuedStamp) => Promise<StampResult>;
  now: () => Date;
}): Promise<FlushResult> {
  const { store, userKey, send, now } = opts;
  const outcomes: Outcome[] = [];
  let waiting = false;
  for (const row of await store.list(userKey)) {
    if (now().getTime() - Date.parse(row.scannedAt) > MAX_QUEUE_AGE_MS) {
      await store.remove(row.id);
      outcomes.push({ kind: "rejected", row, failure: "expired" });
      continue;
    }
    const result = await send(row);
    if (result.ok) {
      await store.remove(row.id);
      outcomes.push({ kind: "accepted", row, already: result.already });
    } else if (RETRY_LATER.has(result.failure)) {
      waiting = true;
      break;
    } else if (result.failure === "failed") {
      // Unknown (a server error, say): try again later, but not for ever.
      if (row.tries + 1 >= MAX_TRIES) {
        await store.remove(row.id);
        outcomes.push({ kind: "rejected", row, failure: "failed" });
      } else await store.update(row.id, { tries: row.tries + 1 });
    } else {
      await store.remove(row.id);
      outcomes.push({ kind: "rejected", row, failure: result.failure });
    }
  }
  return { outcomes, left: (await store.list(userKey)).length, waiting };
}

/**
 * Runs `fn` only if no other tab is uploading (Web Locks); otherwise does nothing and says so. Where Web Locks are
 * missing the upload runs unguarded: a duplicate is harmless (one stamp per user and place).
 */
export async function withUploadLock<T>(fn: () => Promise<T>): Promise<{ ran: true; value: T } | { ran: false }> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return { ran: true, value: await fn() };
  const got = await locks.request("ktrg-stamp-upload", { ifAvailable: true }, async (lock) => (lock ? { ran: true as const, value: await fn() } : { ran: false as const }));
  return got;
}

export function createMemoryQueueStore(): QueueStore & { rows: QueuedStamp[] } {
  const rows: QueuedStamp[] = [];
  return {
    rows,
    async add(row) {
      rows.push(row);
    },
    async list(userKey) {
      return rows.filter((r) => r.userKey === userKey).sort((a, b) => Date.parse(a.scannedAt) - Date.parse(b.scannedAt));
    },
    async remove(id) {
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows.splice(i, 1);
    },
    async update(id, patch) {
      const r = rows.find((x) => x.id === id);
      if (r) Object.assign(r, patch);
    },
  };
}

/** The IndexedDB store: database `ktrg`, object store `stampQueue`, indexed by user key. Browser only. */
export function createIdbQueueStore(): QueueStore {
  const db = openDB("ktrg", 1, {
    upgrade(d) {
      const s = d.createObjectStore("stampQueue", { keyPath: "id" });
      s.createIndex("userKey", "userKey");
    },
  });
  return {
    async add(row) {
      await (await db).put("stampQueue", row);
    },
    async list(userKey) {
      const rows = (await (await db).getAllFromIndex("stampQueue", "userKey", userKey)) as QueuedStamp[];
      return rows.sort((a, b) => Date.parse(a.scannedAt) - Date.parse(b.scannedAt));
    },
    async remove(id) {
      await (await db).delete("stampQueue", id);
    },
    async update(id, patch) {
      const d = await db;
      const row = (await d.get("stampQueue", id)) as QueuedStamp | undefined;
      if (row) await d.put("stampQueue", { ...row, ...patch });
    },
  };
}
