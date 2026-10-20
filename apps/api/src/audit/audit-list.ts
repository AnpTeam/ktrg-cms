import { eq } from "drizzle-orm";
import type { ReadDef } from "../admin-lists/list-routes";
import type { ListReader } from "../admin-lists/list-service";
import { afterCursor, newestFirst } from "../admin-lists/list-sql";
import type { ListReadStore, ListRow } from "../admin-lists/list-types";
import type { KitServices } from "../auth/route-kit";
import type { Db } from "../db/client";
import { auditLog } from "../db/schema";

/** One audit entry as the admin list shows it: ids only, as stored (an entry never changes, so updatedAt = createdAt). */
export interface AuditListRow extends ListRow {
  action: string;
  targetType: string;
  targetId: string | null;
  actorUserId: string | null;
}

export function createDrizzleAuditListStore(db: Db): ListReadStore<AuditListRow> {
  const out = (r: typeof auditLog.$inferSelect): AuditListRow => ({ ...r, updatedAt: r.createdAt });
  return {
    async list(cursor, limit) {
      const rows = await db
        .select()
        .from(auditLog)
        .where(afterCursor(auditLog.createdAt, auditLog.id, cursor))
        .orderBy(...newestFirst(auditLog.createdAt, auditLog.id))
        .limit(limit);
      return rows.map(out);
    },
    async get(id) {
      const [row] = await db.select().from(auditLog).where(eq(auditLog.id, id)).limit(1);
      return row ? out(row) : null;
    },
  };
}

export interface AuditListServices extends KitServices {
  auditList: ListReader<AuditListRow>;
}

const text = (name: string, ja: string, en: string, inList?: { ja: string; en: string }) => ({
  name,
  kind: "text" as const,
  label: { ja, en },
  readOnly: true,
  ...(inList ? { inList: { text: inList, empty: { ja: "なし", en: "none" } } } : {}),
});

/** The audit log as an admin list (`audit.read`): read only, newest first. Who did what to which id, and when. */
export const auditLogList: ReadDef<"audit", AuditListRow, AuditListServices> = {
  key: "audit",
  permission: "audit.read",
  service: (s) => s.auditList,
  ops: { create: false, edit: false, delete: false },
  ui: {
    title: { ja: "変更の記録", en: "Change log" },
    intro: {
      ja: "管理画面での変更や、ログインに関わる大切な操作の記録です。誰が・何を・どれに・いつ、をIDで残します（名前やメールは残しません）。新しいものが上です。",
      en: "A record of changes made in the admin and of important sign-in actions: who did what to which item, and when, by ID (no names or emails are kept). Newest first.",
    },
    titleField: "action",
    fields: [
      text("action", "操作", "Action"),
      text("targetType", "対象の種類", "Kind of item", { ja: "{value}", en: "{value}" }),
      text("targetId", "対象のID", "Item ID", { ja: "対象 {value}", en: "Item {value}" }),
      text("actorUserId", "操作した人のID", "Done by (account ID)", { ja: "操作した人 {value}", en: "By {value}" }),
      { name: "createdAt", kind: "datetime", label: { ja: "日時", en: "When" }, readOnly: true, inList: {} },
    ],
  },
};
