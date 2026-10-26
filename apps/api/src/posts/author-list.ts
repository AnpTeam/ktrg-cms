import { t, type Static } from "elysia";
import { createMemoryListStore } from "../admin-lists/list-memory-store";
import type { ListDef } from "../admin-lists/list-routes";
import { createListService } from "../admin-lists/list-service";
import { bad, ok, type ListRow, type ListRules, type ListStore } from "../admin-lists/list-types";
import type { AuditWriter } from "../audit/audit-log";
import type { KitServices } from "../auth/route-kit";
import { isPhotoUrl } from "../lib/https-url";

const maybe = (max: number) => t.Union([t.String({ maxLength: max }), t.Null()]);

/**
 * Someone a blog post can be "written by" besides the account that made it: a guest writer, the survey team, a mascot. A name
 * (Japanese required) and a photo. A post picks one in its "written by" dropdown; left empty, the byline is the profile of
 * the account that made the post.
 */
export const AUTHOR_FIELDS = {
  nameJa: t.String({ minLength: 1, maxLength: 100 }),
  nameEn: maybe(100),
  photoUrl: maybe(500),
};

const authorFields = t.Object(AUTHOR_FIELDS);
export type AuthorFields = Static<typeof authorFields>;
export type AuthorRow = ListRow & AuthorFields;
export type AuthorStore = ListStore<AuthorRow, AuthorFields>;

export const AUTHOR_AUDIT = { create: "author.create", update: "author.update", delete: "author.delete" } as const;

/** The Japanese name is not just spaces, a blank English name or photo is cleared, and the photo is an https photo address. */
export const authorRules = (photoHosts: readonly string[] = []): ListRules<AuthorFields> => async (fields) => {
  const out = { ...fields };
  if (out.nameJa !== undefined) {
    out.nameJa = out.nameJa.trim();
    if (out.nameJa === "") return bad("validation_failed");
  }
  if (out.nameEn !== undefined) out.nameEn = out.nameEn?.trim() || null;
  if (out.photoUrl !== undefined) {
    out.photoUrl = out.photoUrl?.trim() || null;
    if (out.photoUrl !== null && !isPhotoUrl(out.photoUrl, photoHosts)) return bad("invalid_photo_url");
  }
  return ok(out);
};

export type AuthorService = ReturnType<typeof createAuthorService>;

export function createAuthorService(deps: { store: AuthorStore; photoHosts?: readonly string[] }) {
  return createListService({ store: deps.store, rules: authorRules(deps.photoHosts) });
}

/** In-memory authors for tests and the dev page. */
export function createMemoryAuthorStore(audit: AuditWriter, opts: { now?: () => Date } = {}) {
  return createMemoryListStore<AuthorFields>(audit, AUTHOR_AUDIT, opts);
}

export interface AuthorServices extends KitServices {
  authors: AuthorService;
}

/** The writers as an admin list (`post.manage`). */
export const authorList: ListDef<"authors", typeof AUTHOR_FIELDS, AuthorRow, AuthorServices> = {
  key: "authors",
  permission: "post.manage",
  fields: AUTHOR_FIELDS,
  service: (s) => s.authors,
  ops: { create: true, edit: true, delete: true },
  ui: {
    title: { ja: "書き手", en: "Writers" },
    intro: {
      ja: "ブログの「書いた人」に選べる人です（ゲストの書き手、取材班、キャラクターなど）。名前と写真を入れます。自分の名前で書くときは、ここに入れなくてかまいません（ログイン中のアカウントのプロフィールが使われます）。",
      en: "People a blog post can be \"written by\" (a guest writer, the survey team, a mascot ...): a name and a photo. To write as yourself you need nothing here (the profile of the account you are logged in with is used).",
    },
    newLabel: { ja: "新しい書き手", en: "New writer" },
    deleteWarning: { ja: "この書き手を削除します。この人が書いたことになっている記事は、記事をつくったアカウントの名前に戻ります。よろしいですか？", en: "Delete this writer? Posts by them go back to showing the account that made them." },
    titleField: "name",
    fields: [
      { name: "name", kind: "bilingual", label: { ja: "名前", en: "Name" }, required: true },
      { name: "photoUrl", kind: "image", label: { ja: "写真", en: "Photo" } },
    ],
  },
};
