import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

const go = (path: string) => proxy(new NextRequest(`http://localhost${path}`));

describe("old /ja and /en addresses", () => {
  test("redirect to the same page without the prefix and keep that language", () => {
    for (const [from, to, locale] of [
      ["/en/routes", "/routes", "en"],
      ["/ja/stamps", "/stamps", "ja"],
      ["/en", "/", "en"],
    ] as const) {
      const res = go(from)!;
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe(to);
      expect(res.cookies.get("locale")?.value).toBe(locale);
    }
  });

  test("a path that only starts with the letters is left alone", () => {
    expect(go("/english")?.headers.get("location") ?? null).toBeNull();
    expect(go("/routes")?.headers.get("location") ?? null).toBeNull();
  });
});
