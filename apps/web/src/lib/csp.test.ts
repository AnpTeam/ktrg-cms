import { describe, expect, test } from "bun:test";
import { buildCsp } from "./csp";

const connect = (csp: string) => csp.split("; ").find((d) => d.startsWith("connect-src "))!;

describe("buildCsp", () => {
  test("with R2_UPLOAD_HOST, only that bucket may be sent files; no wildcard", () => {
    const c = connect(buildCsp({ isProd: true, r2UploadHost: "my-bucket.1234abcd.r2.cloudflarestorage.com" }));
    expect(c).toContain("https://my-bucket.1234abcd.r2.cloudflarestorage.com");
    expect(c).not.toContain("*.r2.cloudflarestorage.com");
  });

  test("without it, any R2 bucket is allowed (the loose default)", () => {
    expect(connect(buildCsp({ isProd: true }))).toContain("https://*.r2.cloudflarestorage.com");
    expect(connect(buildCsp({ isProd: true, r2UploadHost: "  " }))).toContain("https://*.r2.cloudflarestorage.com");
  });

  test("a value that is not a plain host name stops the build instead of widening or breaking the policy", () => {
    for (const bad of ["https://x.r2.cloudflarestorage.com", "x.com; script-src *", "x.com/path", "*.r2.cloudflarestorage.com", "localhost"]) {
      expect(() => buildCsp({ isProd: true, r2UploadHost: bad })).toThrow(/R2_UPLOAD_HOST/);
    }
  });

  test("development adds the dev server; production never allows eval or localhost", () => {
    expect(buildCsp({ isProd: false })).toContain("'unsafe-eval'");
    const prod = buildCsp({ isProd: true });
    expect(prod).not.toContain("unsafe-eval");
    expect(prod).not.toContain("localhost");
    expect(prod).toContain("frame-ancestors 'none'");
  });
});
