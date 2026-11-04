import { describe, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDiskStorage, createR2Storage } from "./upload-storage";

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

describe("createDiskStorage", () => {
  const streamOf = (...parts: string[]) =>
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const p of parts) c.enqueue(new TextEncoder().encode(p));
        c.close();
      },
    });
  async function setup(now = () => 1_800_000_000_000) {
    const root = await mkdtemp(join(tmpdir(), "ktrg-uploads-"));
    const storage = createDiskStorage({ root, uploadPath: "/api/v1/uploads/direct", secret: "s".repeat(64), now });
    const signed = async (key: string, type: string, size: number) => {
      const url = new URL(await storage.presignPut(key, type, size), "https://example.com");
      return Object.fromEntries(url.searchParams);
    };
    return { root, storage, signed };
  }

  test("put keeps the file, list and readText find it", async () => {
    const { root, storage } = await setup();
    await storage.put("photos/a-abc234.jpg", new Uint8Array([1, 2, 3]), "image/jpeg");
    expect(await readFile(join(root, "photos/a-abc234.jpg"))).toEqual(Buffer.from([1, 2, 3]));
    expect((await storage.list("photos/", 10)).map((f) => [f.key, f.size])).toEqual([["photos/a-abc234.jpg", 3]]);
    expect(await storage.list("videos/", 10)).toEqual([]);
  });

  test("a signed PUT with the exact type and length is kept; Japanese names work", async () => {
    const { root, storage, signed } = await setup();
    const key = "videos/加太-abc234.vtt";
    const url = await storage.presignPut(key, "text/vtt", 8);
    expect(url.startsWith("/api/v1/uploads/direct/videos/%E5%8A%A0%E5%A4%AA-abc234.vtt?")).toBe(true);
    expect(await storage.receive(key, await signed(key, "text/vtt", 8), "text/vtt", streamOf("WEBVTT", "\n\n"))).toBe("ok");
    expect(await readFile(join(root, key), "utf8")).toBe("WEBVTT\n\n");
    expect(await storage.readText(key)).toBe("WEBVTT\n\n");
  });

  test("refuses a wrong signature, type, key or an expired address, and keeps nothing of a wrong length", async () => {
    let time = 1_800_000_000_000;
    const { root, storage, signed } = await setup(() => time);
    const key = "videos/walk-abc234.mp4";
    const q = await signed(key, "video/mp4", 4);
    expect(await storage.receive(key, { ...q, sig: "x" + q.sig!.slice(1) }, "video/mp4", streamOf("abcd"))).toBe("forbidden");
    expect(await storage.receive(key, q, "text/html", streamOf("abcd"))).toBe("forbidden");
    expect(await storage.receive("videos/other-abc234.mp4", q, "video/mp4", streamOf("abcd"))).toBe("forbidden");
    expect(await storage.receive(key, { ...q, size: "3" }, "video/mp4", streamOf("abc"))).toBe("forbidden");
    expect(await storage.receive(key, q, "video/mp4", streamOf("abcde"))).toBe("wrong_size");
    expect(await storage.receive(key, q, "video/mp4", streamOf("abc"))).toBe("wrong_size");
    expect(await readdir(join(root, "videos"))).toEqual([]);
    time += 16 * 60 * 1000;
    expect(await storage.receive(key, q, "video/mp4", streamOf("abcd"))).toBe("forbidden");
  });

  test("keys outside photos/ and videos/, or that climb out, are refused", async () => {
    const { storage } = await setup();
    await expect(storage.put("../etc/passwd", new Uint8Array([1]), "image/jpeg")).rejects.toThrow();
    await expect(storage.put("photos/../../x.jpg", new Uint8Array([1]), "image/jpeg")).rejects.toThrow();
    await expect(storage.presignPut("other/x.mp4", "video/mp4", 1)).rejects.toThrow();
    expect(await storage.readText("videos/../../etc/passwd")).toBeNull();
  });
});
