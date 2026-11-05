import { afterEach, expect, test } from "bun:test";
import { postStamp } from "./stamp-client";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
const reading = { lat: 34.4, lng: 135.6, accuracyM: 10 };

test("a server that never answers ends as a network failure, so the stamp can wait on the phone", async () => {
  // Like a real fetch on a dead connection: nothing happens until the request is aborted.
  globalThis.fetch = ((_: unknown, init?: RequestInit) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as unknown as typeof fetch;
  const started = Date.now();
  expect(await postStamp("/api/v1/stamps", "s1", reading, undefined, 30)).toEqual({ ok: false, failure: "network" });
  expect(Date.now() - started).toBeLessThan(1000);
});

test("an answer in time is read as usual", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, stamp: { spotId: "s1", createdAt: "2026-11-05T00:00:00Z" } }), { status: 200 })) as unknown as typeof fetch;
  expect((await postStamp("/api/v1/stamps", "s1", reading, undefined, 1000)).ok).toBe(true);
});
