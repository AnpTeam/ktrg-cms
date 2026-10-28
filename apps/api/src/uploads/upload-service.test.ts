import { describe, expect, test } from "bun:test";
import { MAX_SUBTITLE_BYTES, MAX_UPLOAD_BYTES, createUploadService, photoKey, sniffImage, subtitleKeyFor } from "./upload-service";
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

describe("the photo library list is kept for a minute", () => {
  function counted() {
    const mem = createMemoryStorage();
    let reads = 0;
    let clock = 1_000_000;
    const storage = {
      ...mem.storage,
      list: async (prefix: string, limit: number) => {
        reads++;
        return mem.storage.list(prefix, limit);
      },
    };
    const service = createUploadService({ storage, publicBaseUrl: BASE, log: () => {}, now: () => clock });
    return { service, reads: () => reads, advance: (ms: number) => (clock += ms) };
  }

  test("the second look within a minute does not read the bucket again; after a minute it does", async () => {
    const t = counted();
    await t.service.listPhotos();
    await t.service.listPhotos();
    expect(t.reads()).toBe(1);
    t.advance(61_000);
    await t.service.listPhotos();
    expect(t.reads()).toBe(2);
  });

  test("a new upload shows up at once: it drops the kept list", async () => {
    const t = counted();
    await t.service.listPhotos();
    await t.service.uploadPhoto(new File([JPEG], "new.jpg"));
    const after = await t.service.listPhotos();
    expect(t.reads()).toBe(2);
    expect(after.ok && after.photos.length).toBe(1);
  });

  test("a failure is not kept", async () => {
    const mem = createMemoryStorage();
    const service = createUploadService({ storage: mem.storage, publicBaseUrl: BASE, log: () => {} });
    mem.state.fail = true;
    expect((await service.listPhotos()).ok).toBe(false);
    expect((await service.listPhotos()).ok).toBe(true);
  });
});

describe("subtitles", () => {
  test("their key is the video's own with .vtt; only our videos qualify", () => {
    expect(subtitleKeyFor(`${BASE}/videos/Kada-abc123.mp4`, BASE)).toBe("videos/Kada-abc123.vtt");
    expect(subtitleKeyFor(`${BASE}/videos/%E5%8A%A0%E5%A4%AA-abc123.webm`, BASE)).toBe("videos/加太-abc123.vtt");
    expect(subtitleKeyFor("https://evil.example.com/videos/a.mp4", BASE)).toBeNull();
    expect(subtitleKeyFor(`${BASE}/photos/a.jpg`, BASE)).toBeNull();
    expect(subtitleKeyFor(`${BASE}/videos/../secret.mp4`, BASE)).toBeNull();
  });
  test("signs for a video of ours, refuses anything else or too big", async () => {
    const { service } = setup();
    const ok = await service.createSubtitleUpload({ videoUrl: `${BASE}/videos/a-abc123.mp4`, size: 1200 });
    expect(ok.ok && ok.upload.url).toBe(`${BASE}/videos/a-abc123.vtt`);
    expect(await service.createSubtitleUpload({ videoUrl: `${BASE}/photos/a.jpg`, size: 10 })).toEqual({ ok: false, reason: "invalid_file" });
    expect(await service.createSubtitleUpload({ videoUrl: `${BASE}/videos/a-abc123.mp4`, size: MAX_SUBTITLE_BYTES + 1 })).toEqual({ ok: false, reason: "invalid_file" });
  });
});

describe("readSubtitles", () => {
  const VTT = ["WEBVTT", "", "1", "00:00:00.000 --> 00:00:02.000", "Hello", ""].join("\n");
  const make = (fetcher: typeof fetch) => createUploadService({ storage: createMemoryStorage().storage, publicBaseUrl: BASE, log: () => {}, fetcher });
  const answer = (body: string, status = 200) => (async () => new Response(body, { status })) as unknown as typeof fetch;

  test("reads the .vtt beside one of our videos", async () => {
    const asked: string[] = [];
    const service = make((async (url: string) => (asked.push(url), new Response(VTT))) as unknown as typeof fetch);
    expect(await service.readSubtitles(`${BASE}/videos/walk-ab12.mp4`)).toBe(VTT);
    expect(asked).toEqual([`${BASE}/videos/walk-ab12.vtt`]);
  });

  test("anything that is not one of our videos is refused without reading anything", async () => {
    const asked: string[] = [];
    const service = make((async (url: string) => (asked.push(url), new Response(VTT))) as unknown as typeof fetch);
    for (const url of ["https://evil.example/videos/a.mp4", `${BASE}/photos/a.jpg`, `${BASE}/videos/../secret.mp4`, `${BASE}.evil.example/videos/a.mp4`, "not a url"]) {
      expect(await service.readSubtitles(url)).toBeNull();
    }
    expect(asked).toEqual([]);
  });

  test("a missing file, a failing storage and text that is not WebVTT give nothing", async () => {
    expect(await make(answer("", 404)).readSubtitles(`${BASE}/videos/a.mp4`)).toBeNull();
    expect(await make(answer("<html>nope</html>")).readSubtitles(`${BASE}/videos/a.mp4`)).toBeNull();
    expect(await make((async () => { throw new Error("down"); }) as unknown as typeof fetch).readSubtitles(`${BASE}/videos/a.mp4`)).toBeNull();
    expect(await make(answer("WEBVTT" + "x".repeat(MAX_SUBTITLE_BYTES))).readSubtitles(`${BASE}/videos/a.mp4`)).toBeNull();
  });
});
