import { Elysia, t, type Static } from "elysia";
import { createMemoryListStore } from "../admin-lists/list-memory-store";
import type { ListDef } from "../admin-lists/list-routes";
import { createListService } from "../admin-lists/list-service";
import { bad, ok, type ListRow, type ListRules, type ListStore } from "../admin-lists/list-types";
import type { AuditWriter } from "../audit/audit-log";
import type { KitServices } from "../auth/route-kit";
import { cleanTranslations } from "../db/translations";
import { isHttpsUrl } from "../lib/https-url";
import { translationsSchema } from "../lib/schemas";

/**
 * A photo in the carousel at the top of the home page: an https link (uploaded with POST /admin/uploads, or pasted),
 * a short description read out by screen readers (Japanese required), its place in the order, and whether it shows.
 */
export const BANNER_FIELDS = {
  imageUrl: t.String({ minLength: 1, maxLength: 500 }),
  altJa: t.String({ minLength: 1, maxLength: 200 }),
  altEn: t.Union([t.String({ maxLength: 200 }), t.Null()]),
  /** The other content languages (admin entry; visitors see ja / en). */
  translations: t.Optional(translationsSchema({ alt: 200 })),
  sortOrder: t.Integer({ minimum: 0, maximum: 999 }),
  published: t.Boolean(),
};

const bannerFields = t.Object(BANNER_FIELDS);
export type BannerFields = Static<typeof bannerFields>;
export type BannerRow = ListRow & BannerFields;

export interface BannerStore extends ListStore<BannerRow, BannerFields> {
  /** Published banners in their order (then oldest first). */
  listPublic(): Promise<BannerRow[]>;
}

export const BANNER_AUDIT = { create: "banner.create", update: "banner.update", delete: "banner.delete" } as const;

/** The photo is an https link; the Japanese description is not just spaces; a blank English one is cleared. */
export const bannerRules: ListRules<BannerFields> = async (fields) => {
  const out = { ...fields };
  if (out.imageUrl !== undefined) {
    out.imageUrl = out.imageUrl.trim();
    if (!isHttpsUrl(out.imageUrl)) return bad("invalid_photo_url");
  }
  if (out.altJa !== undefined) {
    out.altJa = out.altJa.trim();
    if (out.altJa === "") return bad("validation_failed");
  }
  if (out.altEn !== undefined) out.altEn = out.altEn?.trim() || null;
  if (out.translations !== undefined) out.translations = cleanTranslations(out.translations);
  return ok(out);
};

export type BannerService = ReturnType<typeof createBannerService>;

export function createBannerService(deps: { store: BannerStore }) {
  return { ...createListService({ store: deps.store, rules: bannerRules }), publicBanners: () => deps.store.listPublic() };
}

/** In-memory banners for tests and the dev page. */
export function createMemoryBannerStore(audit: AuditWriter, opts: { now?: () => Date } = {}) {
  const list = createMemoryListStore<BannerFields>(audit, BANNER_AUDIT, opts);
  const store: BannerStore = {
    ...list.store,
    async listPublic() {
      return [...list.rows.values()].filter((b) => b.published).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime());
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
      ja: "ホームの上に流れる写真です。使ってよい写真だけを載せてください（横長、約1600×1000）。小さい番号から順に表示します。",
      en: "The photos that scroll at the top of the home page. Only use photos the project may use (landscape, about 1600 × 1000). They show in order, smallest number first.",
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
        name: "alt",
        kind: "bilingual",
        label: { ja: "写真の説明", en: "Photo description" },
        hint: { ja: "目の不自由な方のために読み上げられます。例：金剛山の山頂から見た朝日", en: "Read out for people who cannot see the photo. For example: Sunrise from the top of Mt Kongō" },
        required: true,
      },
      {
        name: "sortOrder",
        kind: "number",
        label: { ja: "順番", en: "Order" },
        hint: { ja: "小さい番号から表示します（0〜999）。", en: "Smallest number first (0 to 999)." },
        required: true,
        inList: { text: { ja: "順番 {value}", en: "Order {value}" } },
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

/** What visitors get: published banners in order, without the admin's fields. */
export function publicBannerRoutes(getBanners: () => BannerService) {
  return new Elysia({ detail: { tags: ["Content"] } }).get("/banners", async () => ({
    ok: true as const,
    banners: (await getBanners().publicBanners()).map(({ id, imageUrl, altJa, altEn }) => ({ id, imageUrl, altJa, altEn })),
  }));
}
