import { expect, test } from "bun:test";
import { isInAppBrowser } from "./browser-check";

const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CHROME_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

test("real browsers are not in-app browsers", () => {
  for (const ua of [SAFARI, CHROME_IOS, CHROME_ANDROID]) expect(isInAppBrowser(ua)).toBe(false);
});

test("the browsers inside LINE, Instagram, Facebook and web views are", () => {
  expect(isInAppBrowser(`${SAFARI} Line/13.0.0`)).toBe(true);
  expect(isInAppBrowser(`${CHROME_ANDROID} Instagram 300.0`)).toBe(true);
  expect(isInAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]")).toBe(true);
  expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36")).toBe(true);
  expect(isInAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148")).toBe(true);
});
