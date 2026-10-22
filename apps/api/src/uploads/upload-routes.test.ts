import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createRateLimiter } from "../auth/rate-limit";
import { createMemoryRateLimitStore } from "../auth/rate-limit-memory-store";
import { createMemorySessionStore } from "../auth/session-memory-store";
import { createSessionService } from "../auth/session-service";
import type { AuthUser } from "../auth/user";
import { apiBase } from "../lib/api-errors";
import { uploadRoutes } from "./upload-routes";
import { createUploadService } from "./upload-service";
import { createMemoryStorage } from "./upload-storage";

const admin: AuthUser = { id: "11111111-1111-4111-8111-111111111111", email: "admin@example.com", role: "admin", locale: "ja" };
const alice: AuthUser = { id: "22222222-2222-4222-8222-222222222222", email: "alice@example.com", role: "participant", locale: "ja" };
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function setup(opts: { storage?: boolean } = {}) {
  const users = new Map<string, AuthUser>([[admin.id, { ...admin }], [alice.id, { ...alice }]]);
  const session = createSessionService({ store: createMemorySessionStore(users).store });
  const audit = createMemoryAuditWriter();
  const mem = createMemoryStorage();
  const quiet = () => {}; // the storage-failure test logs on purpose
  const uploads = createUploadService(
    opts.storage === false ? { log: quiet } : { storage: mem.storage, publicBaseUrl: "https://photos.example.com", log: quiet },
  );
  const rateLimit = createRateLimiter({ store: createMemoryRateLimitStore().store, secret: "m".repeat(32) });
  const services = { session, rateLimit, audit: audit.writer, uploads };
  const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(uploadRoutes(() => services, { secureCookies: false }));
  const upload = (file: Blob | null, cookie?: string) => {
    const form = new FormData();
    if (file) form.set("file", file);
    return app.handle(
      new Request("http://localhost/api/v1/admin/uploads", { method: "POST", body: form, headers: cookie ? { cookie } : {} }),
    );
  };
  const video = (body: unknown, cookie?: string) =>
    app.handle(
      new Request("http://localhost/api/v1/admin/uploads/video", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      }),
    );
  const library = (cookie?: string) =>
    app.handle(new Request("http://localhost/api/v1/admin/uploads", { headers: cookie ? { cookie } : {} }));
  const login = async (u: AuthUser) => `session=${(await session.create(users.get(u.id)!)).token}`;
  return { upload, video, library, login, audit, mem };
}

describe("POST /admin/uploads", () => {
  test("an admin uploads a photo: 201, its public address, and one audit row (ids only)", async () => {
    const s = setup();
    const res = await s.upload(new File([JPEG], "photo.jpg"), await s.login(admin));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { ok: true; upload: { id: string; url: string; contentType: string } };
    expect(body.ok).toBe(true);
    expect(body.upload.url).toMatch(/^https:\/\/photos\.example\.com\/photos\/photo-[a-z2-9]{6}\.jpg$/);
    expect(s.mem.files.size).toBe(1);
    expect(s.audit.rows).toMatchObject([{ actorUserId: admin.id, action: "upload.create", targetId: body.upload.id }]);
  });

  test("signed out: 401; a participant: 403; nothing is stored", async () => {
    const s = setup();
    expect((await s.upload(new File([JPEG], "a.jpg"))).status).toBe(401);
    const res = await s.upload(new File([JPEG], "a.jpg"), await s.login(alice));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "forbidden" });
    expect(s.mem.files.size).toBe(0);
    expect(s.audit.rows).toHaveLength(0);
  });

  test("not an image: 400 invalid_file, not stored, not audited", async () => {
    const s = setup();
    const res = await s.upload(new File(["<svg/>"], "a.jpg", { type: "image/jpeg" }), await s.login(admin));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "invalid_file" });
    expect(s.mem.files.size).toBe(0);
    expect(s.audit.rows).toHaveLength(0);
  });

  test("no file in the form: 422", async () => {
    const s = setup();
    expect((await s.upload(null, await s.login(admin))).status).toBe(422);
  });

  test("storage not set up, or failing: 503 uploads_unavailable", async () => {
    const off = setup({ storage: false });
    const res = await off.upload(new File([JPEG], "a.jpg"), await off.login(admin));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: "uploads_unavailable" });

    const s = setup();
    s.mem.state.fail = true;
    expect((await s.upload(new File([JPEG], "a.jpg"), await s.login(admin))).status).toBe(503);
    expect(s.audit.rows).toHaveLength(0);
  });
});

describe("GET /admin/uploads (the photo library)", () => {
  test("an admin sees every uploaded photo with its public address, newest first", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    await s.upload(new File([JPEG], "old.jpg"), cookie);
    await s.upload(new File([JPEG], "new.jpg"), cookie);
    s.mem.files.get([...s.mem.files.keys()][0]!)!.lastModified = new Date("2020-01-01");
    const res = await s.library(cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: true; photos: { key: string; url: string; size: number; uploadedAt: string }[] };
    expect(body.photos).toHaveLength(2);
    expect(body.photos[0]!.url).toMatch(/^https:\/\/photos\.example\.com\/photos\/new-[a-z2-9]{6}\.jpg$/);
    expect(body.photos[1]!.key).toMatch(/^photos\/old-/);
  });

  test("signed out: 401; a participant: 403", async () => {
    const s = setup();
    expect((await s.library()).status).toBe(401);
    expect((await s.library(await s.login(alice))).status).toBe(403);
  });

  test("storage not set up, or failing: 503 uploads_unavailable", async () => {
    const off = setup({ storage: false });
    expect((await off.library(await off.login(admin))).status).toBe(503);
    const s = setup();
    s.mem.state.fail = true;
    expect((await s.library(await s.login(admin))).status).toBe(503);
  });
});

describe("POST /admin/uploads/video", () => {
  const MB = 1024 * 1024;
  test("an admin gets a signed address and the public link; one audit row", async () => {
    const s = setup();
    const res = await s.video({ name: "walk.mp4", contentType: "video/mp4", size: 150 * MB }, await s.login(admin));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { ok: true; upload: { id: string; url: string; uploadUrl: string } };
    expect(body.upload.url).toMatch(/^https:\/\/photos\.example\.com\/videos\/walk-[a-z2-9]{6}\.mp4$/);
    expect(body.upload.uploadUrl).toContain("videos/walk-");
    expect(s.audit.rows).toMatchObject([{ actorUserId: admin.id, action: "upload.create", targetId: body.upload.id }]);
  });

  test("not a video type, or too big: refused", async () => {
    const s = setup();
    const cookie = await s.login(admin);
    expect((await s.video({ name: "a.mov", contentType: "video/quicktime", size: 10 * MB }, cookie)).status).toBe(400);
    expect((await s.video({ name: "a.mp4", contentType: "video/mp4", size: 201 * MB }, cookie)).status).toBe(422);
    expect(s.audit.rows).toHaveLength(0);
  });

  test("signed out: 401; a participant: 403; no storage or storage failing: 503", async () => {
    const s = setup();
    const ok = { name: "a.mp4", contentType: "video/mp4", size: MB };
    expect((await s.video(ok)).status).toBe(401);
    expect((await s.video(ok, await s.login(alice))).status).toBe(403);
    const off = setup({ storage: false });
    expect((await off.video(ok, await off.login(admin))).status).toBe(503);
    s.mem.state.fail = true;
    expect((await s.video(ok, await s.login(admin))).status).toBe(503);
  });
});
