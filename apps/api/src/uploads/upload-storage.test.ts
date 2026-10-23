import { describe, expect, test } from "bun:test";
import { createR2Storage } from "./upload-storage";

// The real signer, with made-up keys: nothing is sent anywhere.
describe("createR2Storage.presignPut", () => {
  test("the address holds no checksum of an empty body, and signs the content type and length", async () => {
    const storage = createR2Storage({ accountId: "acc", accessKeyId: "AKID", secretAccessKey: "secret", bucket: "bkt" });
    const url = new URL(await storage.presignPut("videos/walk-abc234.mp4", "video/mp4", 150 * 1024 * 1024));
    expect(url.host).toBe("bkt.acc.r2.cloudflarestorage.com");
    expect([...url.searchParams.keys()].filter((k) => k.toLowerCase().includes("checksum"))).toEqual([]);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
  });
});
