import { describe, expect, test } from "bun:test";
import { readJson } from "./read-json";

describe("readJson", () => {
  test("gives the parsed body", async () => {
    expect(await readJson<{ ok: boolean }>(new Response(JSON.stringify({ ok: true })))).toEqual({ ok: true });
  });
  test("gives null, not a throw, for an answer that is not JSON (a proxy's error page)", async () => {
    expect(await readJson(new Response("<html>502</html>", { status: 502 }))).toBeNull();
  });
  test("gives null for an empty body", async () => {
    expect(await readJson(new Response(null, { status: 204 }))).toBeNull();
  });
});
