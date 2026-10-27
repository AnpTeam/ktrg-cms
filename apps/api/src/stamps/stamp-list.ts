import { and, eq } from "drizzle-orm";
import { t } from "elysia";
import type { ReadDef } from "../admin-lists/list-routes";
import type { ListReader } from "../admin-lists/list-service";
import { afterCursor, newestFirst } from "../admin-lists/list-sql";
import type { ListReadStore } from "../admin-lists/list-types";
import type { KitServices } from "../auth/route-kit";
import type { Db } from "../db/client";
import { spotTranslations, stamps, users } from "../db/schema";
import type { StampListRow } from "./stamp-types";

/** What an admin may change on a stamp: only whether it is revoked. */
export const STAMP_FIELDS = { revoked: t.Boolean() };

const columns = {
  id: stamps.id,
  createdAt: stamps.createdAt,
  memberId: users.publicId,
  spotName: spotTranslations.name,
  flagged: stamps.flagged,
  flagReason: stamps.flagReason,
  revokedAt: stamps.revokedAt,
};

export function createDrizzleStampListStore(db: Db): ListReadStore<StampListRow> {
  const out = (r: { id: string; createdAt: Date; memberId: string; spotName: string | null; flagged: boolean; flagReason: string | null; revokedAt: Date | null }): StampListRow => ({
    id: r.id,
    createdAt: r.createdAt,
    updatedAt: r.createdAt,
    memberId: r.memberId,
    spotName: r.spotName ?? "",
    flagged: r.flagged,
    flagReason: r.flagReason,
    revoked: r.revokedAt !== null,
  });
  const base = () =>
    db
      .select(columns)
      .from(stamps)
      .innerJoin(users, eq(users.id, stamps.userId))
      .leftJoin(spotTranslations, and(eq(spotTranslations.spotId, stamps.spotId), eq(spotTranslations.locale, "ja")));
  return {
    async list(cursor, limit) {
      return (await base().where(afterCursor(stamps.createdAt, stamps.id, cursor)).orderBy(...newestFirst(stamps.createdAt, stamps.id)).limit(limit)).map(out);
    },
    async get(id) {
      const [row] = await base().where(eq(stamps.id, id)).limit(1);
      return row ? out(row) : null;
    },
  };
}

export interface StampListServices extends KitServices {
  stampList: ListReader<StampListRow>;
}

const yesNo = { yes: { ja: "はい", en: "Yes" }, no: { ja: "いいえ", en: "No" } };

/**
 * The stamps as an admin list (`stamp.review`), newest first. Stamps appear on their own when visitors collect them;
 * the form shows one and has one switch, 取り消す (revoked). Saving goes to stamp-admin-routes.ts, not the generic writes.
 */
export const stampList: ReadDef<"stamps", StampListRow, StampListServices> & { fields: typeof STAMP_FIELDS } = {
  key: "stamps",
  permission: "stamp.review",
  service: (s) => s.stampList,
  fields: STAMP_FIELDS,
  ops: { create: false, edit: true, delete: false },
  ui: {
    title: { ja: "スタンプ", en: "Stamps" },
    intro: {
      ja: "参加者が場所の近くで押したスタンプです。自動で増えるので、ここで作る必要はありません。GPSの精度が低いものには印がつきます。おかしいスタンプは取り消せます（記録は残り、あとで戻せます）。",
      en: "Stamps collected by visitors near a place. They appear on their own, so nothing is created here. Stamps with a weak GPS reading are flagged. A suspicious stamp can be revoked (the record stays and can be restored).",
    },
    titleField: "spotName",
    fields: [
      { name: "spotName", kind: "text", label: { ja: "場所", en: "Place" }, readOnly: true, inList: {} },
      { name: "memberId", kind: "text", label: { ja: "会員番号", en: "Member ID" }, readOnly: true, inList: {} },
      { name: "flagged", kind: "boolean", label: { ja: "確認が必要", en: "Needs a look" }, readOnly: true, inList: { ...yesNo, tone: { yes: "warn" } } },
      { name: "flagReason", kind: "text", label: { ja: "理由", en: "Reason" }, readOnly: true },
      { name: "revoked", kind: "boolean", label: { ja: "取り消す", en: "Revoked" }, inList: { ...yesNo, tone: { yes: "bad" } } },
      { name: "createdAt", kind: "datetime", label: { ja: "押した日時", en: "Collected" }, readOnly: true },
    ],
  },
};
