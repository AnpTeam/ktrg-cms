import { describe, expect, test } from "bun:test";
import { MAX_UPLOAD_BYTES, createUploadService, photoKey, sniffImage } from "./upload-service";
import { createMemoryStorage } from "./upload-storage";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const WEBP = new Uint8Array([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBPVP8 ")]);
const BASE = "https://photos.example.com";

function setup() {
  const mem = createMemoryStorage();
  const logs: string[] = [];
  const service = createUploadService({ storage: mem.storage, publicBaseUrl: BASE, log: (m) => logs.push(m) });
  return { ...mem, service, logs };
}

describe("sniffImage", () => {
  test("knows JPEG, PNG and WebP by their first bytes", () => {
    expect(sniffImage(JPEG)?.type).toBe("image/jpeg");
    expect(sniffImage(PNG)?.type).toBe("image/png");
    expect(sniffImage(WEBP)?.type).toBe("image/webp");
  });

  test("refuses anything else, whatever it is called", () => {
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe("photoKey", () => {
  const fixed = () => "abc234";

  test("keeps a readable name, Japanese included", () => {
    expect(photoKey("0-Start-寺田バス停.jpg", "jpg", fixed)).toBe("photos/0-Start-寺田バス停-abc234.jpg");
    expect(photoKey("葛城 山頂 view.JPG", "jpg", fixed)).toBe("photos/葛城-山頂-view-abc234.jpg");
  });

  test("drops path tricks and odd characters, and has a fallback name", () => {
    expect(photoKey("../../etc/passwd.png", "png", fixed)).toBe("photos/etcpasswd-abc234.png");
    expect(photoKey("a/b\\c?#%&.jpg", "jpg", fixed)).toBe("photos/abc-abc234.jpg");
    expect(photoKey("", "webp", fixed)).toBe("photos/photo-abc234.webp");
    expect(photoKey("...", "jpg", fixed)).toBe("photos/photo-abc234.jpg");
  });

  test("cuts long names, and the extension always comes from the real type", () => {
    expect(photoKey(`${"長".repeat(100)}.png`, "jpg", fixed)).toBe(`photos/${"長".repeat(60)}-abc234.jpg`);
  });
});

describe("uploadPhoto", () => {
  test("stores the image under its own name (plus a random ending) and answers its public address", async () => {
    const s = setup();
    const result = await s.service.uploadPhoto(new File([JPEG], "0-Start-寺田バス停.png", { type: "image/png" }));
    if (!result.ok) throw new Error(result.reason);
    const { id, key, url, contentType, size } = result.upload;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    // The extension and type come from the bytes, not from the name or what the browser said.
    expect(key).toMatch(/^photos\/0-Start-寺田バス停-[a-z2-9]{6}\.jpg$/);
    expect(contentType).toBe("image/jpeg");
    expect(url).toBe(`${BASE}/${key.split("/").map(encodeURIComponent).join("/")}`);
    expect(decodeURI(url)).toBe(`${BASE}/${key}`);
    expect(size).toBe(JPEG.length);
    expect(s.files.get(key)?.contentType).toBe("image/jpeg");
  });

  test("two uploads of the same file never overwrite each other", async () => {
    const s = setup();
    await s.service.uploadPhoto(new File([PNG], "a.png"));
    await s.service.uploadPhoto(new File([PNG], "a.png"));
    expect(s.files.size).toBe(2);
  });

  test("refuses non-images, empty files and files over the limit", async () => {
    const s = setup();
    expect(await s.service.uploadPhoto(new File(["<svg/>"], "x.jpg", { type: "image/jpeg" }))).toEqual({ ok: false, reason: "invalid_file" });
    expect(await s.service.uploadPhoto(new File([], "x.jpg"))).toEqual({ ok: false, reason: "invalid_file" });
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(JPEG);
    expect(await s.service.uploadPhoto(new File([big], "big.jpg"))).toEqual({ ok: false, reason: "invalid_file" });
    expect(s.files.size).toBe(0);
  });

  test("without storage configured, uploads are unavailable", async () => {
    const service = createUploadService({});
    expect(await service.uploadPhoto(new File([JPEG], "x.jpg"))).toEqual({ ok: false, reason: "uploads_unavailable" });
  });

  test("a storage failure is unavailable, and the log names no file", async () => {
    const s = setup();
    s.state.fail = true;
    expect(await s.service.uploadPhoto(new File([JPEG], "secret-name.jpg"))).toEqual({ ok: false, reason: "uploads_unavailable" });
    expect(s.logs).toHaveLength(1);
    expect(s.logs[0]).not.toContain("secret-name");
  });
});
