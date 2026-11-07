import { publicCache } from "../lib/public-cache";
import { Elysia, t, type Static } from "elysia";
import { createMemoryListStore } from "../admin-lists/list-memory-store";
import { rowOut, type ListDef } from "../admin-lists/list-routes";
import { createListService } from "../admin-lists/list-service";
import { bad, ok, type ListRow, type ListRules, type ListStore } from "../admin-lists/list-types";
import type { AuditWriter } from "../audit/audit-log";
import { fail } from "../auth/http";
import { routeKit, type KitServices, type RouteOptions } from "../auth/route-kit";
import { cleanTranslations } from "../db/translations";
import { isPhotoUrl } from "../lib/https-url";
import { translationsSchema } from "../lib/schemas";

/**
 * A photo in the carousel at the top of the home page: an https link (uploaded with POST /admin/uploads, or pasted),
 * a short description read out by screen readers (Japanese required), its place in the order, and whether it shows.
 */
export const BANNER_FIELDS = {
  imageUrl: t.String({ minLength: 1, maxLength: 500 }),
  /** Who took the photo / where it is from, shown on it (may hold links). */
  imageCredit: t.Optional(t.Union([t.String({ maxLength: 500 }), t.Null()])),
  altJa: t.String({ minLength: 1, maxLength: 200 }),
  altEn: t.Union([t.String({ maxLength: 200 }), t.Null()]),
  /** The other content languages (admin entry; visitors see ja / en). */
  translations: t.Optional(translationsSchema({ alt: 200 })),
  published: t.Boolean(),
};

const bannerFields = t.Object(BANNER_FIELDS);
export type BannerFields = Static<typeof bannerFields>;
/** `sortOrder` is not a field of the form: a new banner goes last, and the arrows on the banner page move it. */
export type BannerRow = ListRow & BannerFields & { sortOrder: number };

export interface BannerStore extends ListStore<BannerRow, BannerFields> {
  /** Published banners in their order (then oldest first). */
  listPublic(): Promise<BannerRow[]>;
  /** Every banner, in the same order. */
  listOrdered(): Promise<BannerRow[]>;
  /** Puts them in this order. False unless `ids` is every banner, once each. */
  reorder(actor: string, ids: string[]): Promise<boolean>;
}

export const BANNER_AUDIT = { create: "banner.create", update: "banner.update", delete: "banner.delete" } as const;

/**
 * The photo is an https link (on one of `photoHosts`, PHOTO_HOSTS, when that is set); the Japanese description is not
 * just spaces; a blank English one is cleared.
 */
export const bannerRules = (photoHosts: readonly string[] = []): ListRules<BannerFields> => async (fields) => {
  const out = { ...fields };
  if (out.imageUrl !== undefined) {
    out.imageUrl = out.imageUrl.trim();
    if (!isPhotoUrl(out.imageUrl, photoHosts)) return bad("invalid_photo_url");
  }
  if (out.altJa !== undefined) {
    out.altJa = out.altJa.trim();
    if (out.altJa === "") return bad("validation_failed");
  }
  if (out.altEn !== undefined) out.altEn = out.altEn?.trim() || null;
  if (out.imageCredit !== undefined) out.imageCredit = out.imageCredit?.trim() || null;
  if (out.translations !== undefined) out.translations = cleanTranslations(out.translations);
  return ok(out);
};

export type BannerService = ReturnType<typeof createBannerService>;

export function createBannerService(deps: { store: BannerStore; photoHosts?: readonly string[] }) {
  return {
    ...createListService({ store: deps.store, rules: bannerRules(deps.photoHosts) }),
    publicBanners: () => deps.store.listPublic(),
    ordered: () => deps.store.listOrdered(),
    reorder: (actor: string, ids: string[]) => deps.store.reorder(actor, ids),
  };
}

/** In-memory banners for tests and the dev page. */
export function createMemoryBannerStore(audit: AuditWriter, opts: { now?: () => Date } = {}) {
  const list = createMemoryListStore<BannerFields & { sortOrder: number }>(audit, BANNER_AUDIT, opts);
  const ordered = () => [...list.rows.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime());
  const store: BannerStore = {
    ...list.store,
    create: (actor, fields) => list.store.create(actor, { ...fields, sortOrder: Math.max(0, ...[...list.rows.values()].map((b) => b.sortOrder)) + 1 }),
    async listPublic() {
      return ordered().filter((b) => b.published);
    },
    async listOrdered() {
      return ordered();
    },
    async reorder(actor, ids) {
      if (ids.length !== list.rows.size || new Set(ids).size !== ids.length || !ids.every((id) => list.rows.has(id))) return false;
      ids.forEach((id, i) => (list.rows.get(id)!.sortOrder = i + 1));
      await audit.record({ actorUserId: actor, action: "banner.reorder", targetId: null });
      return true;
    },
  };
  return { store, rows: list.rows };
}

export interface BannerServices extends KitServices {
  banners: BannerService;
}

/** The home page banners as an admin list (`banner.manage`). */
export const bannerList: ListDef<"banners", typeof BANNER_FIELDS, BannerRow, BannerServices> = {
  key: "banners",
  permission: "banner.manage",
  fields: BANNER_FIELDS,
  service: (s) => s.banners,
  ops: { create: true, edit: true, delete: true },
  ui: {
    title: { ja: "バナー", en: "Banners" },
    intro: {
      ja: "ホームの上に流れる写真です。使ってよい写真だけを載せてください（横長、約1600×1000）。上から順に表示します。矢印で順番を変えられます。",
      en: "The photos that scroll at the top of the home page. Only use photos the project may use (landscape, about 1600 × 1000). They show from the top down; use the arrows to change the order.",
    },
    newLabel: { ja: "新しいバナー", en: "New banner" },
    deleteWarning: { ja: "このバナーを削除します。よろしいですか？（写真のファイルは残ります）", en: "Delete this banner? (The photo file itself is kept.)" },
    titleField: "alt",
    fields: [
      {
        name: "imageUrl",
        kind: "image",
        label: { ja: "写真", en: "Photo" },
        hint: { ja: "アップロードするか、https:// で始まるリンクを入れてください。", en: "Upload one, or paste a link starting with https://." },
        required: true,
      },
      {
        name: "imageCredit",
        kind: "text",
        label: { ja: "写真の出どころ", en: "Photo credit" },
        hint: {
          ja: "写真の上に ℹ︎ と一緒に表示されます。リンクは [表示する文字](https://…) の形で書けます。例：撮影：山田 太郎 / [Wikimedia Commons](https://commons.wikimedia.org/)",
          en: "Shown on the photo with an ℹ︎. A link is written [text](https://…). For example: Photo: Taro Yamada / [Wikimedia Commons](https://commons.wikimedia.org/)",
        },
      },
      {
        name: "alt",
        kind: "bilingual",
        label: { ja: "写真の説明", en: "Photo description" },
        hint: { ja: "目の不自由な方のために読み上げられます。例：金剛山の山頂から見た朝日", en: "Read out for people who cannot see the photo. For example: Sunrise from the top of Mt Kongō" },
        required: true,
      },
      {
        name: "published",
        kind: "boolean",
        label: { ja: "公開する（ホームに表示する）", en: "Publish (show on the home page)" },
        inList: { yes: { ja: "公開中", en: "Published" }, no: { ja: "下書き", en: "Draft" } },
      },
    ],
  },
};

/** The banner page: every banner in the order visitors see them, and the arrows that change it. */
export function bannerOrderRoutes(getServices: () => BannerServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  return new Elysia({ prefix: "/admin", detail: { tags: ["Admin content"] } })
    .use(plugins)
    .get("/banners/order", async () => ({ ok: true as const, items: (await getServices().banners.ordered()).map(rowOut) }), { auth: "banner.manage" })
    .put(
      "/banners/order",
      async ({ user, body, set }) => ((await getServices().banners.reorder(user.id, body.ids)) ? { ok: true as const } : fail(set, 422, "validation_failed")),
      { auth: "banner.manage", rateLimit: { adminWriteUser: "user.id" }, body: t.Object({ ids: t.Array(t.String({ format: "uuid" }), { maxItems: 1000 }) }) },
    );
}

/** What visitors get: published banners in order, without the admin's fields. */
export function publicBannerRoutes(getBanners: () => BannerService) {
  return new Elysia({ detail: { tags: ["Content"] } }).get("/banners", async ({ set }) => {
    publicCache(set);
    return {
      ok: true as const,
      banners: (await getBanners().publicBanners()).map(({ id, imageUrl, imageCredit, altJa, altEn }) => ({ id, imageUrl, imageCredit, altJa, altEn })),
    };
  });
}
