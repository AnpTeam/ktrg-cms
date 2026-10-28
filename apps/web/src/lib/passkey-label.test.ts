import { describe, expect, test } from "bun:test";
import { passkeyLabel } from "./auth-client";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const WIN_EDGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const MAC_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

describe("passkeyLabel", () => {
  test("names the device and browser", () => {
    expect(passkeyLabel(IPHONE_SAFARI)).toBe("iPhone · Safari");
    expect(passkeyLabel(IPHONE_CHROME)).toBe("iPhone · Chrome");
    expect(passkeyLabel(WIN_EDGE)).toBe("Windows · Edge");
    expect(passkeyLabel(ANDROID_CHROME)).toBe("Android · Chrome");
    expect(passkeyLabel(MAC_SAFARI)).toBe("Mac · Safari");
  });

  test("an iPad that reports as a Mac is an iPad", () => {
    expect(passkeyLabel(MAC_SAFARI, 5)).toBe("iPad · Safari");
  });

  test("an unknown browser gives an empty name, so the page falls back to its numbered name", () => {
    expect(passkeyLabel("")).toBe("");
  });
});
