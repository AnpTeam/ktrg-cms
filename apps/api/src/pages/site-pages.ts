import { publicCache } from "../lib/public-cache";
import { Elysia, t, type Static } from "elysia";
import { createMemoryListStore } from "../admin-lists/list-memory-store";
import type { ListDef } from "../admin-lists/list-routes";
import { createListService } from "../admin-lists/list-service";
import { bad, ok, type ListRow, type ListRules, type ListStore } from "../admin-lists/list-types";
import type { AuditWriter } from "../audit/audit-log";
import type { KitServices } from "../auth/route-kit";

const maybe = (max: number) => t.Union([t.String({ maxLength: max }), t.Null()]);

/**
 * A page an editor makes (管理 > ページの文章 > 新しいページ), shown to visitors at /p/<slug> once published. The text uses the
 * same small format as the built-in pages' text (a `## heading` starts a section; see the web app's lib/page-text.ts).
 * Japanese is the page's language; the English title and text are shown to English visitors when they are written.
 */
export const SITE_PAGE_FIELDS = {
  slug: t.String({ minLength: 1, maxLength: 60 }),
  titleJa: t.String({ minLength: 1, maxLength: 200 }),
  titleEn: maybe(200),
  bodyJa: t.String({ maxLength: 30000 }),
  bodyEn: maybe(30000),
  published: t.Boolean(),
};

const sitePageFields = t.Object(SITE_PAGE_FIELDS);
export type SitePageFields = Static<typeof sitePageFields>;
export type SitePageRow = ListRow & SitePageFields;

export interface SitePageStore extends ListStore<SitePageRow, SitePageFields> {
  findBySlug(slug: string): Promise<SitePageRow | null>;
  /** Published pages, oldest first (the order they were made in). */
  listPublished(): Promise<SitePageRow[]>;
}

export const SITE_PAGE_AUDIT = { create: "site_page.create", update: "site_page.update", delete: "site_page.delete" } as const;

/** The address of a page: lower-case letters, digits and single hyphens ("access-guide"). */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Trims the words, clears a blank English one, and keeps the address well-formed and used once. */
export const sitePageRules = (store: Pick<SitePageStore, "findBySlug">): ListRules<SitePageFields> => async (fields) => {
  const out: Partial<SitePageFields> = { ...fields };
  if (out.slug !== undefined) {
    out.slug = out.slug.trim().toLowerCase();
    if (!SLUG.test(out.slug)) return bad("validation_failed");
    // On an edit the rules see the whole row (with its id), so a page never clashes with itself.
    const taken = await store.findBySlug(out.slug);
    if (taken && taken.id !== (fields as { id?: string }).id) return bad("conflict");
  }
  if (out.titleJa !== undefined) {
    out.titleJa = out.titleJa.trim();
    if (out.titleJa === "") return bad("validation_failed");
  }
  if (typeof out.titleEn === "string") out.titleEn = out.titleEn.trim() || null;
  if (typeof out.bodyEn === "string") out.bodyEn = out.bodyEn.trim() || null;
  return ok(out);
};

export type SitePageService = ReturnType<typeof createSitePageService>;

export function createSitePageService(deps: { store: SitePageStore }) {
  return {
    ...createListService({ store: deps.store, rules: sitePageRules(deps.store) }),
    async published(slug: string): Promise<SitePageRow | null> {
      const row = await deps.store.findBySlug(slug);
      return row?.published ? row : null;
    },
    listPublished: () => deps.store.listPublished(),
  };
}

/** In-memory pages for tests and the dev page. */
export function createMemorySitePageStore(audit: AuditWriter, opts: { now?: () => Date } = {}) {
  const list = createMemoryListStore<SitePageFields>(audit, SITE_PAGE_AUDIT, opts);
  const store: SitePageStore = {
    ...list.store,
    async findBySlug(slug) {
      return [...list.rows.values()].find((r) => r.slug === slug) ?? null;
    },
    async listPublished() {
      return [...list.rows.values()].filter((r) => r.published).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
  };
  return { store, rows: list.rows };
}

export interface SitePageServices extends KitServices {
  sitePages: SitePageService;
}

/** The pages editors make, as an admin list (`notice.manage`, like the page text). */
export const sitePageList: ListDef<"site-pages", typeof SITE_PAGE_FIELDS, SitePageRow, SitePageServices> = {
  key: "site-pages",
  permission: "notice.manage",
  fields: SITE_PAGE_FIELDS,
  service: (s) => s.sitePages,
  ops: { create: true, edit: true, delete: true },
  ui: {
    title: { ja: "つくったページ", en: "Pages you made" },
    intro: {
      ja: "自分でつくるページです。公開すると、サイトの「/p/アドレス」で見られます。",
      en: "Pages you make yourself. Once published they are at /p/<address> on the site.",
    },
    newLabel: { ja: "新しいページ", en: "New page" },
    deleteWarning: { ja: "このページを削除します。公開中なら、見られなくなります。よろしいですか？", en: "Delete this page? If it is published, visitors can no longer see it." },
    titleField: "title",
    fields: [
      { name: "title", kind: "bilingual", label: { ja: "題", en: "Title" }, required: true },
      {
        name: "slug",
        kind: "text",
        label: { ja: "アドレス", en: "Address" },
        hint: { ja: "半角の小文字・数字・ハイフンだけ。例：access-guide（サイトでは /p/access-guide になります）", en: "Lower-case letters, digits and hyphens only. For example: access-guide (it becomes /p/access-guide)" },
        required: true,
        inList: { text: { ja: "/p/{value}", en: "/p/{value}" } },
      },
      {
        name: "body",
        kind: "bilingual-long",
        label: { ja: "本文", en: "Text" },
      },
      { name: "published", kind: "boolean", label: { ja: "公開する", en: "Publish" }, inList: { yes: { ja: "公開中", en: "Published" }, no: { ja: "下書き", en: "Draft" } } },
    ],
  },
};

/** What visitors get: a published page by its address, and the list of published pages (for links to them). */
export function publicSitePageRoutes(getPages: () => SitePageService) {
  return new Elysia({ detail: { tags: ["Content"] } })
    .get("/site-pages", async ({ set }) => {
      publicCache(set);
      return { ok: true as const, pages: (await getPages().listPublished()).map((p) => ({ slug: p.slug, titleJa: p.titleJa, titleEn: p.titleEn })) };
    })
    .get(
      "/site-pages/:slug",
      async ({ params, set }) => {
        publicCache(set);
        const p = await getPages().published(params.slug);
        return { ok: true as const, page: p ? { slug: p.slug, titleJa: p.titleJa, titleEn: p.titleEn, bodyJa: p.bodyJa, bodyEn: p.bodyEn } : null };
      },
      { params: t.Object({ slug: t.String({ maxLength: 60 }) }) },
    );
}
