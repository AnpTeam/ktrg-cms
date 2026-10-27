import { publicCache } from "../lib/public-cache";
import { Elysia } from "elysia";
import type { ListDef } from "../admin-lists/list-routes";
import type { KitServices } from "../auth/route-kit";
import type { NoticeService } from "./notice-service";
import { NOTICE_FIELDS, type NoticeRow } from "./notice-types";

export interface NoticeServices extends KitServices {
  notices: NoticeService;
}

/**
 * The admin list of trail notices: `/admin/lists/notices`, admins only (`notice.manage`). Its screens are drawn from
 * `ui` (CLAUDE.md, "Spot status and safety": entered by hand after checking an official source).
 */
export const noticeList: ListDef<"notices", typeof NOTICE_FIELDS, NoticeRow, NoticeServices> = {
  key: "notices",
  permission: "notice.manage",
  fields: NOTICE_FIELDS,
  service: (s) => s.notices,
  ops: { create: true, edit: true, delete: true },
  ui: {
    title: { ja: "お知らせ", en: "Notices" },
    intro: {
      ja: "通行止めや危ない所などのお知らせです。公式の情報（県・市町村・寺社のサイトなど）を確かめてから書き、確かめた日と出典を入れてください。名前を押すと直せます。",
      en: "Notices about closures, hazards and the like. Check the official information (prefecture, municipality, temple or shrine sites) before writing one, and give the day you checked and the source. Select a title to edit it.",
    },
    newLabel: { ja: "新しいお知らせ", en: "New notice" },
    deleteWarning: { ja: "このお知らせを削除します。よろしいですか？", en: "Delete this notice?" },
    titleField: "title",
    fields: [
      { name: "title", kind: "bilingual", label: { ja: "見出し", en: "Title" }, required: true },
      { name: "body", kind: "bilingual-long", label: { ja: "本文", en: "Text" }, required: true },
      {
        name: "routeId",
        kind: "route",
        label: { ja: "ルート", en: "Route" },
        noneLabel: { ja: "全体（ルートを決めない）", en: "Whole trail (no route)" },
        inList: { empty: { ja: "全体", en: "Whole trail" } },
      },
      {
        name: "sourceUrl",
        kind: "url",
        label: { ja: "出典のリンク", en: "Source link" },
        hint: { ja: "https:// で始まる公式のページのアドレス", en: "The address of the official page, starting with https://" },
        required: true,
      },
      {
        name: "sourceName",
        kind: "bilingual",
        label: { ja: "出典の名前", en: "Source name" },
        hint: { ja: "例：奈良県 / 御所市", en: "For example: Nara Prefecture / Gose City" },
        required: true,
      },
      {
        name: "verifiedOn",
        kind: "date",
        label: { ja: "確認した日", en: "Checked on" },
        hint: { ja: "出典を最後に確かめた日。訪れる人に表示します。", en: "The day the source was last checked. Shown to visitors." },
        required: true,
        inList: { text: { ja: "{value} に確認", en: "Checked {value}" } },
      },
      {
        name: "expiresOn",
        kind: "date",
        label: { ja: "表示する最後の日", en: "Last day shown" },
        hint: { ja: "この日を過ぎると表示されません。空なら、消すまで表示します。", en: "Hidden after this day. Leave it empty to show it until it is deleted." },
        optional: true,
        inList: { text: { ja: "{value} まで", en: "Until {value}" }, empty: { ja: "期限なし", en: "No end date" } },
      },
      {
        name: "published",
        kind: "boolean",
        label: { ja: "公開する（訪れる人に見せる）", en: "Publish (show to visitors)" },
        inList: { yes: { ja: "公開中", en: "Published" }, no: { ja: "下書き", en: "Draft" } },
      },
    ],
  },
};

/** What a visitor sees of a notice: no draft flag, no edit times, no other languages (the site speaks ja / en). */
const publicOut = ({ published: _p, createdAt: _c, updatedAt: _u, translations: _t, ...n }: NoticeRow) => n;

/** What visitors read, no login: published notices that have not expired (Japan time), the most recently checked first. */
export function publicNoticeRoutes(getNotices: () => NoticeService) {
  return new Elysia({ detail: { tags: ["Content"] } }).get("/notices", async ({ set }) => {
    publicCache(set, 30); // hazards and closures: a shorter wait than the rest
    return { ok: true as const, notices: (await getNotices().publicNotices()).map(publicOut) };
  });
}
