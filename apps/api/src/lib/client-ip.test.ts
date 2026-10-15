import { describe, expect, test } from "bun:test";
import { clientIp } from "./client-ip";

describe("clientIp", () => {
  test("without a trusted proxy, X-Forwarded-For is ignored", () => {
    expect(
      clientIp({ headers: { "x-forwarded-for": "6.6.6.6" }, requestIp: "10.0.0.5", trustProxy: false }),
    ).toBe("10.0.0.5");
  });

  test("behind a trusted proxy, the last entry is used (earlier ones can be forged)", () => {
    expect(
      clientIp({ headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9" }, requestIp: "10.0.0.5", trustProxy: true }),
    ).toBe("203.0.113.9");
  });

  test("falls back to the socket address when the header is missing or empty", () => {
    expect(clientIp({ headers: {}, requestIp: "10.0.0.5", trustProxy: true })).toBe("10.0.0.5");
    expect(clientIp({ headers: { "x-forwarded-for": " , " }, requestIp: "10.0.0.5", trustProxy: true })).toBe("10.0.0.5");
  });

  test("with no address at all, everyone shares the 'unknown' bucket", () => {
    expect(clientIp({ headers: {}, trustProxy: false })).toBe("unknown");
  });
});
