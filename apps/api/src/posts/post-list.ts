import { publicCache } from "../lib/public-cache";
import { Elysia, t, type Static } from "elysia";
import { createMemoryListStore } from "../admin-lists/list-memory-store";
import type { ListDef } from "../admin-lists/list-routes";
import { createListService } from "../admin-lists/list-service";
import { bad, ok, type ListRow, type ListRules, type ListStore } from "../admin-lists/list-types";
import type { AuditWriter } from "../audit/audit-log";
import { fail } from "../auth/http";
import type { KitServices } from "../auth/route-kit";
import { cleanTranslations } from "../db/translations";
import { isPhotoUrl } from "../lib/https-url";
import { translationsSchema, uuidParams } from "../lib/schemas";
import { todayInJapan } from "../notices/notice-service";

const nullable = (max: number) => t.Union([t.String({ maxLength: max }), t.Null()]);

/** The most posts one public answer carries. A blog of tens of posts never reaches it; a runaway one cannot grow the answer without end. */
export const PUBLIC_POSTS_LIMIT = 50;

/**
 * A blog post as the admin writes it: a title and body, an optional photo at the top, who wrote it, and the day it
 * is dated. Japanese is required and English falls back to it. A draft until published, and hidden until its day
 * arrives, so a post can be written early. The body may hold the rich-text markers (links, footnotes, headings,
 * lists, photos) that the web app renders.
 */
export const POST_FIELDS = {
  titleJa: t.String({ minLength: 1, maxLength: 200 }),
  titleEn: nullable(200),
  bodyJa: t.String({ minLength: 1, maxLength: 20000 }),
  bodyEn: nullable(20000),
  authorNameJa: nullable(100),
  authorNameEn: nullable(100),
  coverPhotoUrl: nullable(500),
  coverCredit: nullable(500),
  authorPhotoUrl: nullable(500),
  /** The place of the directory this post is about, or none. */
  placeId: t.Union([t.String({ format: "uuid" }), t.Null()]),
  /** A route and a waypoint (a sutra mound is one) this post is about, or none. */
  routeId: t.Union([t.String({ format: "uuid" }), t.Null()]),
  spotId: t.Union([t.String({ format: "uuid" }), t.Null()]),
  /** The writer picked for the post (see author-list.ts), or none: the byline is then the account that made it. */
  authorId: t.Union([t.String({ format: "uuid" }), t.Null()]),
  /** The other content languages (admin entry; visitors see ja / en). */
  translations: t.Optional(translationsSchema({ title: 200, body: 20000, authorName: 100 })),
  /** YYYY-MM-DD, Japan time: the day the post is dated and from which visitors see it. */
  publishedOn: t.String({ format: "date" }),
  published: t.Boolean(),
};

const postFields = t.Object(POST_FIELDS);
export type PostFields = Static<typeof postFields>;
/** The account behind a post is read with it (never saved from the form): its name and photo are the byline when the post names no one. */
export type PostRow = ListRow & PostFields & { authorUserId?: string | null; accountName?: string | null; accountPhotoUrl?: string | null; writer?: { nameJa: string; nameEn: string | null; photoUrl: string | null } | null };

export interface PostStore extends ListStore<PostRow, PostFields> {
  /** Published posts dated `today` (YYYY-MM-DD) or earlier, newest first, at most PUBLIC_POSTS_LIMIT. */
  listPublic(today: string): Promise<PostRow[]>;
  /** One post, only if a visitor may read it on `today`. */
  getPublic(id: string, today: string): Promise<PostRow | null>;
}

export const POST_AUDIT = { create: "post.create", update: "post.update", delete: "post.delete" } as const;

const REQUIRED = ["titleJa", "bodyJa"] as const;
const OPTIONAL = ["titleEn", "bodyEn", "authorNameJa", "authorNameEn", "coverCredit"] as const;
const PHOTOS = ["coverPhotoUrl", "authorPhotoUrl"] as const;

/**
 * The Japanese title and body are required (not just spaces), blank English and blank optional text are cleared,
 * and each photo is an https link (on one of `photoHosts`, PHOTO_HOSTS, when that is set).
 */
export const postRules = (photoHosts: readonly string[] = []): ListRules<PostFields> => async (fields) => {
  const out = { ...fields };
  for (const k of REQUIRED) {
    if (out[k] === undefined) continue;
    out[k] = out[k].trim();
    if (out[k] === "") return bad("validation_failed");
  }
  for (const k of OPTIONAL) if (out[k] !== undefined) out[k] = out[k]?.trim() || null;
  for (const k of PHOTOS) {
    if (out[k] === undefined) continue;
    out[k] = out[k]?.trim() || null;
    if (out[k] !== null && !isPhotoUrl(out[k]!, photoHosts)) return bad("invalid_photo_url");
  }
  if (out.translations !== undefined) out.translations = cleanTranslations(out.translations);
  return ok(out);
};

export type PostService = ReturnType<typeof createPostService>;

/** The admin list of blog posts, and what visitors read. */
export function createPostService(deps: { store: PostStore; photoHosts?: readonly string[]; now?: () => Date; placeExists?: (id: string) => Promise<boolean>; routeExists?: (id: string) => Promise<boolean>; spotExists?: (id: string) => Promise<boolean>; authorExists?: (id: string) => Promise<boolean> }) {
  const now = deps.now ?? (() => new Date());
  return {
    ...createListService({ store: deps.store, rules: postRules(deps.photoHosts), relations: {
        ...(deps.placeExists ? { placeId: deps.placeExists } : {}),
        ...(deps.routeExists ? { routeId: deps.routeExists } : {}),
        ...(deps.spotExists ? { spotId: deps.spotExists } : {}),
        ...(deps.authorExists ? { authorId: deps.authorExists } : {}),
      },
    }),
    publicPosts: () => deps.store.listPublic(todayInJapan(now())),
    publicPost: (id: string) => deps.store.getPublic(id, todayInJapan(now())),
  };
}

/** In-memory posts for tests and the dev page. */
export function createMemoryPostStore(audit: AuditWriter, opts: { now?: () => Date } = {}) {
  const list = createMemoryListStore<PostFields>(audit, POST_AUDIT, opts);
  const readable = (p: PostRow, today: string) => p.published && p.publishedOn <= today;
  const store: PostStore = {
    ...list.store,
    async listPublic(today) {
      return [...list.rows.values()]
        .filter((p) => readable(p, today))
        .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn) || b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, PUBLIC_POSTS_LIMIT);
    },
    async getPublic(id, today) {
      const post = list.rows.get(id);
      return post && readable(post, today) ? post : null;
    },
  };
  return { store, rows: list.rows };
}

export interface PostServices extends KitServices {
  posts: PostService;
}

/** The blog as an admin list (`post.manage`). Its screens are generated, so there is no web code per field. */
export const postList: ListDef<"posts", typeof POST_FIELDS, PostRow, PostServices> = {
  key: "posts",
  permission: "post.manage",
  fields: POST_FIELDS,
  service: (s) => s.posts,
  ops: { create: true, edit: true, delete: true },
  ui: {
    title: { ja: "ブログ", en: "Blog" },
    intro: {
      ja: "ブログの記事です。「公開する」にチェックを入れ、「日付」の日になると、訪れる人に表示されます。見出しを押すと直せます。",
      en: "The blog posts. A post appears to visitors once it is published and its date has arrived. Select a heading to edit it.",
    },
    newLabel: { ja: "新しい記事", en: "New post" },
    deleteWarning: { ja: "この記事を削除します。よろしいですか？（写真のファイルは残ります）", en: "Delete this post? (The photo files themselves are kept.)" },
    titleField: "title",
    fields: [
      { name: "title", kind: "bilingual", label: { ja: "見出し", en: "Title" }, required: true },
      {
        name: "body",
        kind: "bilingual-long",
        label: { ja: "本文", en: "Text" },
        required: true,
      },
      {
        name: "publishedOn",
        kind: "date",
        side: true,
        label: { ja: "日付", en: "Date" },
        hint: { ja: "記事の日付です。この日になるまで、訪れる人には表示されません。", en: "The date of the post. Visitors do not see it until this day arrives." },
        required: true,
        inList: { text: { ja: "{value}", en: "{value}" } },
      },
      {
        name: "published",
        kind: "boolean",
        side: true,
        label: { ja: "公開する（訪れる人に見せる）", en: "Publish (show to visitors)" },
        inList: { yes: { ja: "公開中", en: "Published" }, no: { ja: "下書き", en: "Draft" } },
      },
      {
        name: "coverPhotoUrl",
        kind: "image",
        side: true,
        label: { ja: "上の写真", en: "Photo at the top" },
        hint: { ja: "アップロードするか、https:// で始まるリンクを入れてください。空でもかまいません。", en: "Upload one, or paste a link starting with https://. It may be left empty." },
      },
      {
        name: "coverCredit",
        kind: "text",
        side: true,
        label: { ja: "写真の出どころ", en: "Photo credit" },
        hint: {
          ja: "写真の上に ℹ︎ と一緒に表示されます。リンクは [表示する文字](https://…) の形で書けます。",
          en: "Shown on the photo with an ℹ︎. A link is written [text](https://…).",
        },
      },
      {
        name: "authorId",
        kind: "relation",
        side: true,
        to: "authors",
        label: { ja: "書いた人", en: "Written by" },
        hint: { ja: "ふつうは「自分」のままで、ログイン中のアカウントのプロフィール（名前と写真）が使われます。ゲストの書き手やキャラクターで出したいときは、一覧から選びます（「書き手」の画面で足せます）。", en: "Usually left as yourself: the profile (name and photo) of the account you are logged in with. To post as a guest writer or a character, choose one from the list (add them under Writers)." },
        noneLabel: { ja: "自分（ログイン中のアカウント）", en: "Me (the account I am logged in with)" },
      },
      {
        name: "authorName",
        kind: "bilingual",
        side: true,
        label: { ja: "名前を直接入れる（ふだんは空のまま）", en: "Type a name instead (usually left empty)" },
        hint: { ja: "この記事だけ別の名前にしたいときに入れます。上の「書いた人」より優先されます。空のままでかまいません。", en: "For a one-off name on this post only; it wins over \"Written by\" above. May be left empty." },
      },
      { name: "authorPhotoUrl", kind: "image", side: true, label: { ja: "書いた人の写真", en: "Author's photo" }, hint: { ja: "空のままにすると、プロフィールの写真が使われます。", en: "Left empty, the profile photo is used." } },
      { name: "routeId", kind: "route", side: true, label: { ja: "この記事のルート", en: "The route this post is about" }, noneLabel: { ja: "（なし）", en: "(none)" } },
      {
        name: "spotId",
        kind: "relation",
        side: true,
        to: "places",
        label: { ja: "この記事の経由地・経塚", en: "The waypoint or sutra mound this post is about" },
        hint: { ja: "経由地の一覧から選びます（経塚も経由地です）。記事の下に、その場所のカードが出ます。", en: "Choose from the waypoints list (a sutra mound is a waypoint). A card for it is shown under the post." },
        noneLabel: { ja: "（なし）", en: "(none)" },
      },
      {
        name: "placeId",
        kind: "relation",
        side: true,
        to: "directory",
        label: { ja: "この記事の場所", en: "The place this post is about" },
        hint: { ja: "場所の一覧（お店・トイレ・駅など）から選ぶと、記事の下に、その場所の詳しい情報と、近くの場所が出ます。空でもかまいません。", en: "Choose one from the places directory (shops, toilets, stations ...) and its details and the places near it are shown under the post. It may be left empty." },
        noneLabel: { ja: "（なし）", en: "(none)" },
      },
    ],
  },
};

/**
 * What a visitor sees of a post: no draft flag, no edit times, no other languages (the site speaks ja / en), and no account
 * id. The byline is the name typed on the post, else the profile name of whoever made it; likewise the photo.
 */
const publicOut = ({ published: _p, createdAt: _c, updatedAt: _u, translations: _t, authorUserId: _a, accountName, accountPhotoUrl, writer, ...post }: PostRow) => ({
  ...post,
  // The name typed on the post, else the picked writer, else the account that made it.
  authorNameJa: post.authorNameJa ?? writer?.nameJa ?? accountName ?? null,
  authorNameEn: post.authorNameEn ?? (post.authorNameJa ? null : (writer ? writer.nameEn : (accountName ?? null))),
  authorPhotoUrl: post.authorPhotoUrl ?? (writer ? writer.photoUrl : (accountPhotoUrl ?? null)),
});

/**
 * The list is for cards, which show a few lines: the start of the text is enough, and a whole blog of full bodies would
 * pass the size Next.js will cache. The post's own page asks for the full text.
 */
export const LIST_BODY_CHARS = 600;
const listOut = (post: PostRow) => {
  const out = publicOut(post);
  return { ...out, bodyJa: out.bodyJa.slice(0, LIST_BODY_CHARS), bodyEn: out.bodyEn === null ? null : out.bodyEn.slice(0, LIST_BODY_CHARS) };
};

/** What visitors read, no login: published posts whose day has come, newest first, and one post by its id. */
export function publicPostRoutes(getPosts: () => PostService) {
  return new Elysia({ detail: { tags: ["Content"] } })
    .get("/posts", async ({ set }) => {
      publicCache(set);
      return { ok: true as const, posts: (await getPosts().publicPosts()).map(listOut) };
    })
    .get(
      "/posts/:id",
      async ({ params, set }) => {
        const post = await getPosts().publicPost(params.id);
        if (post) publicCache(set);
        return post ? { ok: true as const, post: publicOut(post) } : fail(set, 404, "not_found");
      },
      { params: uuidParams },
    );
}
