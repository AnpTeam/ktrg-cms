import { t, type Static } from "elysia";
import type { ListRow, ListStore } from "../admin-lists/list-types";

const nullable = (max: number) => t.Union([t.String({ maxLength: max }), t.Null()]);

/**
 * A trail notice as the admin writes it (CLAUDE.md, "Spot status and safety"): a title and text, the official source
 * it was taken from, the day a person last checked that source, and an optional last day. Japanese is required,
 * English falls back to it. No route means the whole trail. A draft until published.
 */
export const NOTICE_FIELDS = {
  routeId: t.Union([t.String({ format: "uuid" }), t.Null()]),
  titleJa: t.String({ minLength: 1, maxLength: 200 }),
  titleEn: nullable(200),
  bodyJa: t.String({ minLength: 1, maxLength: 5000 }),
  bodyEn: nullable(5000),
  sourceUrl: t.String({ minLength: 1, maxLength: 500 }),
  sourceNameJa: t.String({ minLength: 1, maxLength: 200 }),
  sourceNameEn: nullable(200),
  /** YYYY-MM-DD, Japan time. */
  verifiedOn: t.String({ format: "date" }),
  /** YYYY-MM-DD; hidden from visitors after this day. null = until someone removes it. */
  expiresOn: t.Union([t.String({ format: "date" }), t.Null()]),
  published: t.Boolean(),
};

const noticeFields = t.Object(NOTICE_FIELDS);
export type NoticeFields = Static<typeof noticeFields>;
export type NoticeRow = ListRow & NoticeFields;

export interface NoticeStore extends ListStore<NoticeRow, NoticeFields> {
  routeExists(id: string): Promise<boolean>;
  /** Published notices that have not expired on `today` (YYYY-MM-DD), the most recently checked first. */
  listPublic(today: string): Promise<NoticeRow[]>;
}
