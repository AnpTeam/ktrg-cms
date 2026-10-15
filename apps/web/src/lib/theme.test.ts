import { describe, expect, test } from "bun:test";
import { nextTheme, parseTheme, themeCookieString, themeFromValue } from "./theme";

describe("theme", () => {
  test("the button cycles auto, light, dark and back", () => {
    expect(nextTheme("auto")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("auto");
  });

  test("parses the saved theme out of a cookie header", () => {
    expect(parseTheme("theme=dark")).toBe("dark");
    expect(parseTheme("locale=ja; theme=light; other=1")).toBe("light");
  });

  test("anything else is auto", () => {
    expect(parseTheme("")).toBe("auto");
    expect(parseTheme(undefined)).toBe("auto");
    expect(parseTheme("theme=purple")).toBe("auto");
    expect(parseTheme("mytheme=dark")).toBe("auto");
  });

  test("cookie strings: a year for a choice, removed for auto, Secure on https", () => {
    expect(themeCookieString("dark", false)).toBe("theme=dark; Path=/; SameSite=Lax; Max-Age=31536000");
    expect(themeCookieString("light", true)).toContain("; Secure");
    expect(themeCookieString("auto", false)).toBe("theme=; Path=/; SameSite=Lax; Max-Age=0");
  });

  test("the server reads a single cookie value", () => {
    expect(themeFromValue("light")).toBe("light");
    expect(themeFromValue("dark")).toBe("dark");
    expect(themeFromValue("")).toBe("auto");
    expect(themeFromValue(undefined)).toBe("auto");
    expect(themeFromValue("purple")).toBe("auto");
  });
});
