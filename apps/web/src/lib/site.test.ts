import { expect, test } from "bun:test";
import { siteOrigin } from "./site";

test("the site address has no trailing slash and defaults to local development", () => {
  expect(siteOrigin({ SITE_URL: "https://example.com/" })).toBe("https://example.com");
  expect(siteOrigin({ SITE_URL: "https://example.com" })).toBe("https://example.com");
  expect(siteOrigin({})).toBe("http://localhost:3000");
});
