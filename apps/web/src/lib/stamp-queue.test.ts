import { describe, expect, test } from "bun:test";
import type { StampResult } from "./stamp-flow";
import { createMemoryQueueStore, flushQueue, MAX_QUEUE_AGE_MS, MAX_TRIES, newQueuedStamp, withUploadLock } from "./stamp-queue";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const at = (msAgo: number) => new Date(NOW.getTime() - msAgo);
const reading = { lat: 34.3, lng: 135.1, accuracyM: 12 };
const ok = (already = false): StampResult => ({ ok: true, already });

async function queueOf(...rows: { spot: string; ago: number; user?: string }[]) {
  const store = createMemoryQueueStore();
  rows.forEach((r, i) => void store.add(newQueuedStamp(r.user ?? "u1", r.spot, reading, at(r.ago), `id-${i}`)));
  await Promise.resolve();
  return store;
}
const run = (store: ReturnType<typeof createMemoryQueueStore>, send: (spot: string) => StampResult, userKey = "u1") =>
  flushQueue({ store, userKey, send: async (row) => send(row.spotId), now: () => NOW });

describe("flushQueue", () => {
  test("sends oldest first, removes what the server accepted, and says which were already held", async () => {
    const store = await queueOf({ spot: "b", ago: 1000 }, { spot: "a", ago: 5000 });
    const order: string[] = [];
    const res = await run(store, (s) => (order.push(s), ok(s === "a")));
    expect(order).toEqual(["a", "b"]);
    expect(res.outcomes.map((o) => [o.kind, o.row.spotId, o.kind === "accepted" && o.already])).toEqual([["accepted", "a", true], ["accepted", "b", false]]);
    expect(res).toMatchObject({ left: 0, waiting: false });
    expect(store.rows).toEqual([]); // no coordinates left behind
  });

  test("a dropped signal stops the upload, keeps every row and burns no tries", async () => {
    const store = await queueOf({ spot: "a", ago: 3000 }, { spot: "b", ago: 2000 });
    const res = await run(store, () => ({ ok: false, failure: "network" }));
    expect(res).toMatchObject({ left: 2, waiting: true, outcomes: [] });
    expect(store.rows.map((r) => r.tries)).toEqual([0, 0]);
  });

  test("a definite no removes that row, tells why, and carries on with the next", async () => {
    const store = await queueOf({ spot: "far", ago: 3000 }, { spot: "good", ago: 2000 });
    const res = await run(store, (s) => (s === "far" ? { ok: false, failure: "too_far" } : ok()));
    expect(res.outcomes.map((o) => [o.kind, o.kind === "rejected" ? o.failure : "ok"])).toEqual([["rejected", "too_far"], ["accepted", "ok"]]);
    expect(res.left).toBe(0);
  });

  test("an unknown failure is retried, then given up after MAX_TRIES", async () => {
    const store = await queueOf({ spot: "x", ago: 1000 });
    for (let i = 1; i < MAX_TRIES; i++) {
      expect((await run(store, () => ({ ok: false, failure: "failed" }))).left).toBe(1);
      expect(store.rows[0]!.tries).toBe(i);
    }
    const last = await run(store, () => ({ ok: false, failure: "failed" }));
    expect(last).toMatchObject({ left: 0, outcomes: [{ kind: "rejected", failure: "failed" }] });
  });

  test("a row older than the age limit is dropped without a request", async () => {
    const store = await queueOf({ spot: "old", ago: MAX_QUEUE_AGE_MS + 1000 }, { spot: "new", ago: 1000 });
    const sent: string[] = [];
    const res = await run(store, (s) => (sent.push(s), ok()));
    expect(sent).toEqual(["new"]);
    expect(res.outcomes.map((o) => (o.kind === "rejected" ? o.failure : o.kind))).toEqual(["expired", "accepted"]);
  });

  test("rows of another user key are never touched or sent", async () => {
    const store = await queueOf({ spot: "mine", ago: 1000 }, { spot: "theirs", ago: 1000, user: "u2" });
    const sent: string[] = [];
    await run(store, (s) => (sent.push(s), ok()));
    expect(sent).toEqual(["mine"]);
    expect(store.rows.map((r) => r.spotId)).toEqual(["theirs"]);
  });
});

describe("withUploadLock", () => {
  test("runs the work when there is no Web Locks API", async () => {
    expect(await withUploadLock(async () => 7)).toEqual({ ran: true, value: 7 });
  });
});
