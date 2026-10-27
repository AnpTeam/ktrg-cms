import { describe, expect, test } from "bun:test";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { createMemoryPostStore, createPostService, LIST_BODY_CHARS, PUBLIC_POSTS_LIMIT } from "./post-list";

const actor = "11111111-1111-4111-8111-111111111111";

/** 15:30 UTC is already the next day in Japan, so "today" here is 2026-10-21. */
const NOW = new Date("2026-10-20T15:30:00Z");

const post = (over: Record<string, unknown> = {}) => ({
  titleJa: " 金剛山の秋 ",
  titleEn: "  ",
  bodyJa: " 紅葉が見事です。 ",
  bodyEn: null,
  authorNameJa: "  ",
  authorNameEn: null,
  coverPhotoUrl: null,
  coverCredit: "  ",
  authorPhotoUrl: null,
  placeId: null,
  routeId: null,
  spotId: null,
  authorId: null,
  publishedOn: "2026-10-20",
  published: false,
  ...over,
});

function setup() {
  const audit = createMemoryAuditWriter();
  const mem = createMemoryPostStore(audit.writer);
  return { svc: createPostService({ store: mem.store, now: () => NOW }), audit, mem };
}

describe("blog posts", () => {
  test("cleaned on save: text trimmed, blank optional text cleared; audited", async () => {
    const s = setup();
    const r = await s.svc.create(actor, post());
    expect(r.ok && r.value).toMatchObject({
      titleJa: "金剛山の秋",
      titleEn: null,
      bodyJa: "紅葉が見事です。",
      authorNameJa: null,
      coverCredit: null,
    });
    expect(s.audit.rows.map((a) => a.action)).toEqual(["post.create"]);
  });

  test("refused: a photo link that is not https, a Japanese title or body of only spaces", async () => {
    const s = setup();
    const bad = { ok: false, reason: "invalid_photo_url" } as const;
    expect(await s.svc.create(actor, post({ coverPhotoUrl: "http://img.example.com/a.jpg" }))).toEqual(bad);
    expect(await s.svc.create(actor, post({ authorPhotoUrl: "http://img.example.com/me.jpg" }))).toEqual(bad);
    expect(await s.svc.create(actor, post({ titleJa: "   " }))).toEqual({ ok: false, reason: "validation_failed" });
    expect(await s.svc.create(actor, post({ bodyJa: "   " }))).toEqual({ ok: false, reason: "validation_failed" });
    expect(s.audit.rows).toEqual([]);
  });

  test("an https photo link is kept, trimmed", async () => {
    const s = setup();
    const r = await s.svc.create(actor, post({ coverPhotoUrl: " https://img.example.com/a.jpg " }));
    expect(r.ok && r.value.coverPhotoUrl).toBe("https://img.example.com/a.jpg");
  });

  test("visitors get published posts whose day has come, newest first; drafts and future days are hidden", async () => {
    const s = setup();
    await s.svc.create(actor, post({ titleJa: "昨日・先に書いた", published: true, publishedOn: "2026-10-20" }));
    await s.svc.create(actor, post({ titleJa: "昨日・あとで書いた", published: true, publishedOn: "2026-10-20" }));
    await s.svc.create(actor, post({ titleJa: "今日", published: true, publishedOn: "2026-10-21" }));
    await s.svc.create(actor, post({ titleJa: "明日", published: true, publishedOn: "2026-10-22" }));
    await s.svc.create(actor, post({ titleJa: "下書き", published: false, publishedOn: "2026-10-20" }));

    // Newest day first; two posts on one day show the one written later first. Tomorrow's and the draft are missing.
    expect((await s.svc.publicPosts()).map((p) => p.titleJa)).toEqual(["今日", "昨日・あとで書いた", "昨日・先に書いた"]);
  });

  test("one post by id: only when a visitor may read it", async () => {
    const s = setup();
    const made = await s.svc.create(actor, post({ published: false }));
    const id = made.ok ? made.value.id : "";
    expect(await s.svc.publicPost(id)).toBeNull();

    await s.svc.update(actor, id, (await s.svc.get(id))!.updatedAt, { published: true });
    expect((await s.svc.publicPost(id))?.titleJa).toBe("金剛山の秋");

    await s.svc.update(actor, id, (await s.svc.get(id))!.updatedAt, { publishedOn: "2026-10-22" });
    expect(await s.svc.publicPost(id)).toBeNull(); // dated tomorrow
    expect(await s.svc.publicPost("11111111-1111-4111-8111-999999999999")).toBeNull();
  });

  test("the public list is capped, so one runaway blog cannot grow the answer without end", async () => {
    const s = setup();
    for (let i = 0; i < PUBLIC_POSTS_LIMIT + 3; i++) {
      await s.svc.create(actor, post({ titleJa: `記事${i}`, published: true }));
    }
    expect(await s.svc.publicPosts()).toHaveLength(PUBLIC_POSTS_LIMIT);
  });

  test("a post may be about a place of the directory; one that does not exist is refused", async () => {
    const audit = createMemoryAuditWriter();
    const known = "22222222-2222-4222-8222-222222222222";
    const svc = createPostService({ store: createMemoryPostStore(audit.writer).store, now: () => NOW, placeExists: async (id) => id === known });
    expect((await svc.create(actor, post({ placeId: known }))).ok).toBe(true);
    expect(await svc.create(actor, post({ placeId: "33333333-3333-4333-8333-333333333333" }))).toMatchObject({ ok: false });
  });

  test("the byline is the name on the post, else the profile name of whoever made it; the account id is never sent", async () => {
    const audit = createMemoryAuditWriter();
    const mem = createMemoryPostStore(audit.writer);
    const svc = createPostService({ store: mem.store, now: () => NOW });
    const made = await svc.create(actor, post({ published: true }));
    if (!made.ok) throw new Error("not made");
    mem.rows.set(made.value.id, { ...made.value, authorUserId: actor, accountName: "山田", accountPhotoUrl: "https://example.com/a.jpg" } as never);
    const { publicPostRoutes } = await import("./post-list");
    const { Elysia } = await import("elysia");
    const { apiBase } = await import("../lib/api-errors");
    const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(publicPostRoutes(() => svc));
    const body = (await (await app.handle(new Request(`http://localhost/api/v1/posts/${made.value.id}`))).json()) as { post: Record<string, unknown> };
    expect(body.post).toMatchObject({ authorNameJa: "山田", authorPhotoUrl: "https://example.com/a.jpg" });
    expect(JSON.stringify(body)).not.toContain(actor);
    mem.rows.set(made.value.id, { ...mem.rows.get(made.value.id)!, authorNameJa: "取材班" });
    const named = (await (await app.handle(new Request(`http://localhost/api/v1/posts/${made.value.id}`))).json()) as { post: Record<string, unknown> };
    expect(named.post.authorNameJa).toBe("取材班");
  });

  test("a picked writer wins over the account that made the post; the name typed on the post wins over both", async () => {
    const audit = createMemoryAuditWriter();
    const mem = createMemoryPostStore(audit.writer);
    const svc = createPostService({ store: mem.store, now: () => NOW });
    const made = await svc.create(actor, post({ published: true }));
    if (!made.ok) throw new Error("not made");
    const set = (extra: object) => mem.rows.set(made.value.id, { ...made.value, authorUserId: actor, accountName: "山田", accountPhotoUrl: "https://example.com/me.jpg", ...extra } as never);
    const { publicPostRoutes } = await import("./post-list");
    const { Elysia } = await import("elysia");
    const { apiBase } = await import("../lib/api-errors");
    const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(publicPostRoutes(() => svc));
    const read = async () => ((await (await app.handle(new Request(`http://localhost/api/v1/posts/${made.value.id}`))).json()) as { post: Record<string, unknown> }).post;
    set({});
    expect(await read()).toMatchObject({ authorNameJa: "山田", authorPhotoUrl: "https://example.com/me.jpg" });
    set({ writer: { nameJa: "取材班", nameEn: "Survey team", photoUrl: "https://example.com/team.jpg" } });
    expect(await read()).toMatchObject({ authorNameJa: "取材班", authorNameEn: "Survey team", authorPhotoUrl: "https://example.com/team.jpg" });
    set({ writer: { nameJa: "取材班", nameEn: null, photoUrl: null }, authorNameJa: "ゲスト" });
    expect(await read()).toMatchObject({ authorNameJa: "ゲスト", authorPhotoUrl: null });
  });

  test("the list carries only the start of each text and is cached for a minute; one post carries all of it", async () => {
    const audit = createMemoryAuditWriter();
    const svc = createPostService({ store: createMemoryPostStore(audit.writer).store, now: () => NOW });
    const long = "あ".repeat(LIST_BODY_CHARS + 500);
    const made = await svc.create(actor, post({ published: true, bodyJa: long, bodyEn: long }));
    if (!made.ok) throw new Error("not made");
    const { publicPostRoutes } = await import("./post-list");
    const { Elysia } = await import("elysia");
    const { apiBase } = await import("../lib/api-errors");
    const app = new Elysia({ prefix: "/api/v1" }).use(apiBase()).use(publicPostRoutes(() => svc));
    const list = await app.handle(new Request("http://localhost/api/v1/posts"));
    expect(list.headers.get("cache-control")).toBe("public, max-age=60");
    const { posts } = (await list.json()) as { posts: { bodyJa: string; bodyEn: string | null }[] };
    expect(posts[0]!.bodyJa).toHaveLength(LIST_BODY_CHARS);
    expect(posts[0]!.bodyEn).toHaveLength(LIST_BODY_CHARS);
    const one = (await (await app.handle(new Request(`http://localhost/api/v1/posts/${made.value.id}`))).json()) as { post: { bodyJa: string } };
    expect(one.post.bodyJa).toHaveLength(long.length);
  });
});
