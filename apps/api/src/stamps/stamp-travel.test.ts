import { describe, expect, test } from "bun:test";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createGuestService } from "../guest/guest-service";
import { createMemoryStampStore } from "./stamp-memory-store";
import { createStampService } from "./stamp-service";
import type { StampSpot } from "./stamp-types";

const USER = "22222222-2222-4222-8222-222222222222";
const A = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", lat: 34.3, lng: 135.1 };
const B = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", lat: 34.33, lng: 135.1 }; // about 3.3 km from A
const C = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", lat: 34.3004, lng: 135.1 }; // about 45 m from A
const spot = (p: { id: string; lat: number; lng: number }): StampSpot => ({ id: p.id, routeId: "route", published: true, stampable: true, positionVerified: true, lat: p.lat, lng: p.lng, radiusM: 50, status: "open" });

function setup(clock: { t: Date }) {
  const mem = createMemoryStampStore(createMemoryAuditWriter().writer, { now: () => clock.t });
  for (const p of [A, B, C]) mem.spots.set(p.id, spot(p));
  const stamps = createStampService({ store: mem.store, now: () => clock.t });
  const reading = (p: typeof A, extra: { scannedAt?: string } = {}) => ({ spotId: p.id, lat: p.lat, lng: p.lng, accuracyM: 10, ...extra });
  const flags = () => [...mem.stamps.values()].map((s) => [s.spotId, s.flagged, s.flagReason]);
  return { mem, stamps, reading, flags };
}

describe("fast travel between two stamps", () => {
  test("a second stamp 3 km away a minute later is stamped but flagged fast_travel", async () => {
    const clock = { t: new Date("2026-11-10T09:00:00Z") };
    const { stamps, reading, flags } = setup(clock);
    expect((await stamps.collect(USER, reading(A))).ok).toBe(true);
    clock.t = new Date("2026-11-10T09:01:00Z");
    const second = await stamps.collect(USER, reading(B));
    expect(second).toMatchObject({ ok: true, value: { flagged: true, alreadyStamped: false } }); // flag, never block
    expect(flags()).toEqual([[A.id, false, null], [B.id, true, "fast_travel"]]);
  });

  test("the same 3 km an hour later is an ordinary walk", async () => {
    const clock = { t: new Date("2026-11-10T09:00:00Z") };
    const { stamps, reading, flags } = setup(clock);
    await stamps.collect(USER, reading(A));
    clock.t = new Date("2026-11-10T10:00:00Z");
    await stamps.collect(USER, reading(B));
    expect(flags().map((f) => f[1])).toEqual([false, false]);
  });

  test("two places 45 m apart pressed seconds apart are not flagged", async () => {
    const clock = { t: new Date("2026-11-10T09:00:00Z") };
    const { stamps, reading, flags } = setup(clock);
    await stamps.collect(USER, reading(A));
    clock.t = new Date("2026-11-10T09:00:03Z");
    await stamps.collect(USER, reading(C));
    expect(flags().map((f) => f[1])).toEqual([false, false]);
  });

  test("a poor reading that is also fast carries both reasons", async () => {
    const clock = { t: new Date("2026-11-10T09:00:00Z") };
    const { stamps, reading, flags } = setup(clock);
    await stamps.collect(USER, reading(A));
    clock.t = new Date("2026-11-10T09:01:00Z");
    await stamps.collect(USER, { ...reading(B), accuracyM: 70 });
    expect(flags()[1]).toEqual([B.id, true, "low_accuracy,fast_travel"]);
  });

  test("an offline stamp is judged by the time it was pressed, not the time it arrived", async () => {
    const clock = { t: new Date("2026-11-10T12:00:00Z") };
    const { stamps, reading, flags } = setup(clock);
    await stamps.collect(USER, reading(A, { scannedAt: "2026-11-10T09:00:00Z" }));
    await stamps.collect(USER, reading(B, { scannedAt: "2026-11-10T10:30:00Z" })); // 1.5 h apart: a walk
    expect(flags().map((f) => f[1])).toEqual([false, false]);
  });

  test("a revoked stamp is not the previous place", async () => {
    const clock = { t: new Date("2026-11-10T09:00:00Z") };
    const { mem, stamps, reading, flags } = setup(clock);
    await stamps.collect(USER, reading(A));
    for (const s of mem.stamps.values()) s.revoked = true;
    clock.t = new Date("2026-11-10T09:01:00Z");
    await stamps.collect(USER, reading(B));
    expect(flags()[1]![1]).toBe(false);
  });
});

describe("a guest's stamps are checked for fast travel when they are claimed", () => {
  test("the later of two far stamps made a minute apart is flagged; the first is not", async () => {
    const clock = { t: new Date("2026-11-10T09:00:00Z") };
    const { mem, stamps, reading } = setup(clock);
    const guest = createGuestService({ stamps, secret: "g".repeat(32), now: () => clock.t });
    let cookie: string | null = null;
    const first = await guest.collect(cookie, reading(A));
    if (!first.ok) throw new Error("setup");
    cookie = first.value.cookie;
    clock.t = new Date("2026-11-10T09:01:00Z");
    const second = await guest.collect(cookie, reading(B));
    if (!second.ok) throw new Error("setup");
    await guest.claim(USER, second.value.cookie);
    const byPlace = new Map([...mem.stamps.values()].map((s) => [s.spotId, [s.flagged, s.flagReason]]));
    expect(byPlace.get(A.id)).toEqual([false, null]);
    expect(byPlace.get(B.id)).toEqual([true, "fast_travel"]);
  });
});
