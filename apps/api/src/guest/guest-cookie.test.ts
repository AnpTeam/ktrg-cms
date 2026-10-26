import { expect, test } from "bun:test";
import { decodeGuest, encodeGuest, GUEST_MAX } from "./guest-cookie";

const SECRET = "s".repeat(32);
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("what goes in comes out, with the rough-reading flag", () => {
  const stamps = [{ spotId: A, at: 1_760_000_000, flagged: false }, { spotId: B, at: 1_760_000_500, flagged: true }];
  expect(decodeGuest(encodeGuest(stamps, SECRET), SECRET)).toEqual(stamps);
  expect(decodeGuest(encodeGuest([], SECRET), SECRET)).toEqual([]);
});

test("a changed, unsigned or foreign cookie holds nothing", () => {
  const good = encodeGuest([{ spotId: A, at: 1, flagged: false }], SECRET);
  expect(decodeGuest(good, "t".repeat(32))).toEqual([]);
  const [body, tag] = good.split(".");
  const forged = encodeGuest([{ spotId: A, at: 1, flagged: false }, { spotId: B, at: 2, flagged: false }], SECRET).split(".")[0];
  expect(decodeGuest(`${forged}.${tag}`, SECRET)).toEqual([]);
  expect(decodeGuest(`${body}.`, SECRET)).toEqual([]);
  for (const junk of [null, undefined, "", "x", "a.b.c", "!!!.???"]) expect(decodeGuest(junk, SECRET)).toEqual([]);
});

test("more than the limit is refused, and 120 stamps fit in a cookie", () => {
  const many = Array.from({ length: GUEST_MAX }, (_, i) => ({ spotId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, at: i, flagged: false }));
  const cookie = encodeGuest(many, SECRET);
  expect(cookie.length).toBeLessThan(3500);
  expect(decodeGuest(cookie, SECRET)).toHaveLength(GUEST_MAX);
  expect(decodeGuest(encodeGuest([...many, many[0]!], SECRET), SECRET)).toEqual([]);
});
