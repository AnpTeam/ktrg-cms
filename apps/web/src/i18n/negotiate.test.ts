import { describe, expect, test } from "bun:test";
import { fromAcceptLanguage, pickLocale } from "./negotiate";

describe("fromAcceptLanguage", () => {
  test("matches the primary subtag", () => {
    expect(fromAcceptLanguage("ja-JP")).toBe("ja");
    expect(fromAcceptLanguage("en-US")).toBe("en");
  });

  test("honours q values over order", () => {
    expect(fromAcceptLanguage("ja;q=0.5, en;q=0.9")).toBe("en");
  });

  test("skips unsupported languages and q=0", () => {
    expect(fromAcceptLanguage("fr, ja;q=0, en;q=0.1")).toBe("en");
    expect(fromAcceptLanguage("fr, de")).toBeUndefined();
    expect(fromAcceptLanguage("*")).toBeUndefined();
  });

  test("ignores a missing or malformed header", () => {
    expect(fromAcceptLanguage(undefined)).toBeUndefined();
    expect(fromAcceptLanguage("en;q=abc, ja")).toBe("ja");
  });
});

describe("pickLocale", () => {
  test("the saved cookie wins over Accept-Language", () => {
    expect(pickLocale({ cookie: "en", acceptLanguage: "ja" })).toBe("en");
  });

  test("an invalid cookie is ignored", () => {
    expect(pickLocale({ cookie: "fr", acceptLanguage: "en" })).toBe("en");
  });

  test("falls back to Japanese", () => {
    expect(pickLocale({})).toBe("ja");
    expect(pickLocale({ acceptLanguage: "fr" })).toBe("ja");
  });
});
