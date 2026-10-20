import { createListService } from "../admin-lists/list-service";
import { bad, ok, type ListRules } from "../admin-lists/list-types";
import { cleanTranslations } from "../db/translations";
import { isHttpsUrl } from "../lib/https-url";
import type { NoticeFields, NoticeStore } from "./notice-types";

const REQUIRED = ["titleJa", "bodyJa", "sourceNameJa"] as const;
const OPTIONAL = ["titleEn", "bodyEn", "sourceNameEn"] as const;

/** Today as YYYY-MM-DD in Japan time. */
export const todayInJapan = (now: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);

/**
 * The rules of a notice: Japanese title, text and source name are required (not just spaces), blank English is
 * cleared, the source is an https link, the last day is not before the day it was checked, and the route exists.
 */
export function noticeRules(store: Pick<NoticeStore, "routeExists">): ListRules<NoticeFields> {
  return async (fields) => {
    const out = { ...fields };
    for (const k of REQUIRED) {
      if (out[k] === undefined) continue;
      out[k] = out[k].trim();
      if (out[k] === "") return bad("validation_failed");
    }
    for (const k of OPTIONAL) if (out[k] !== undefined) out[k] = out[k]?.trim() || null;
    if (out.translations !== undefined) out.translations = cleanTranslations(out.translations);
    if (out.sourceUrl !== undefined) {
      out.sourceUrl = out.sourceUrl.trim();
      if (!isHttpsUrl(out.sourceUrl)) return bad("invalid_source_url");
    }
    // Days as YYYY-MM-DD compare as text. On a change, the service passes the saved row with the change on top.
    if (out.verifiedOn && out.expiresOn && out.expiresOn < out.verifiedOn) return bad("validation_failed");
    if (out.routeId && !(await store.routeExists(out.routeId))) return bad("validation_failed");
    return ok(out);
  };
}

export type NoticeService = ReturnType<typeof createNoticeService>;

/** The admin list of notices, and what visitors read. */
export function createNoticeService(deps: { store: NoticeStore; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  return {
    ...createListService({ store: deps.store, rules: noticeRules(deps.store) }),
    publicNotices: () => deps.store.listPublic(todayInJapan(now())),
  };
}
