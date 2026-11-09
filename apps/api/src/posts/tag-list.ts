import { t, type Static } from "elysia";
import { createMemoryListStore } from "../admin-lists/list-memory-store";
import type { ListDef } from "../admin-lists/list-routes";
import { createListService } from "../admin-lists/list-service";
import { bad, ok, type ListRow, type ListRules, type ListStore } from "../admin-lists/list-types";
import type { AuditWriter } from "../audit/audit-log";
import type { KitServices } from "../auth/route-kit";

/**
 * A word a blog post can be filed under (イベント, 季節, 歴史 ...), in Japanese and English. A post picks any of them; visitors
 * see them on the post and can list the posts of one. A tag that is deleted simply stops showing on its posts.
 */
export const TAG_FIELDS = {
  nameJa: t.String({ minLength: 1, maxLength: 40 }),
  nameEn: t.Union([t.String({ maxLength: 40 }), t.Null()]),
};

const tagFields = t.Object(TAG_FIELDS);
export type TagFields = Static<typeof tagFields>;
export type TagRow = ListRow & TagFields;
export type TagStore = ListStore<TagRow, TagFields>;

export const TAG_AUDIT = { create: "tag.create", update: "tag.update", delete: "tag.delete" } as const;

/** The Japanese name is not just spaces, and a blank English one is cleared. */
export const tagRules: ListRules<TagFields> = async (fields) => {
  const out = { ...fields };
  if (out.nameJa !== undefined) {
    out.nameJa = out.nameJa.trim();
    if (out.nameJa === "") return bad("validation_failed");
  }
  if (out.nameEn !== undefined) out.nameEn = out.nameEn?.trim() || null;
  return ok(out);
};

export type TagService = ReturnType<typeof createTagService>;

export function createTagService(deps: { store: TagStore }) {
  return createListService({ store: deps.store, rules: tagRules });
}

/** In-memory tags for tests and the dev page. */
export function createMemoryTagStore(audit: AuditWriter, opts: { now?: () => Date } = {}) {
  return createMemoryListStore<TagFields>(audit, TAG_AUDIT, opts);
}

export interface TagServices extends KitServices {
  tags: TagService;
}

/** The tags as an admin list (`post.manage`), reached from the blog list like the writers. */
export const tagList: ListDef<"tags", typeof TAG_FIELDS, TagRow, TagServices> = {
  key: "tags",
  permission: "post.manage",
  fields: TAG_FIELDS,
  service: (s) => s.tags,
  ops: { create: true, edit: true, delete: true },
  ui: {
    title: { ja: "タグ", en: "Tags" },
    intro: {
      ja: "ブログの記事につけるタグです（イベント、季節、歴史など）。記事の「詳細」で選びます。訪れる人は、タグからその記事の一覧を見られます。",
      en: "Tags for blog posts (events, seasons, history ...). Pick them on a post's Details tab. Visitors can list the posts of a tag.",
    },
    newLabel: { ja: "新しいタグ", en: "New tag" },
    deleteWarning: { ja: "このタグを削除します。記事からは、このタグが消えます。よろしいですか？", en: "Delete this tag? It disappears from its posts." },
    titleField: "name",
    fields: [{ name: "name", kind: "bilingual", label: { ja: "名前", en: "Name" }, required: true }],
  },
};
