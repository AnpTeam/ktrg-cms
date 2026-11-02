import { eq } from "drizzle-orm";
import type { ReadDef } from "../admin-lists/list-routes";
import type { ListReader } from "../admin-lists/list-service";
import { afterCursor, newestFirst } from "../admin-lists/list-sql";
import type { ListReadStore, ListRow } from "../admin-lists/list-types";
import type { KitServices } from "../auth/route-kit";
import type { Db } from "../db/client";
import { auditLog, users } from "../db/schema";

/**
 * One audit entry as the admin list shows it (an entry never changes, so updatedAt = createdAt). The entry itself holds ids
 * only; `actorName` is read from the account when the list is drawn (null once the account is gone or has no name), so no name
 * is ever written into the permanent log.
 */
export interface AuditListRow extends ListRow {
  action: string;
  targetType: string;
  targetId: string | null;
  actorUserId: string | null;
  actorName: string | null;
}

export function createDrizzleAuditListStore(db: Db): ListReadStore<AuditListRow> {
  const out = (r: typeof auditLog.$inferSelect, actorName: string | null): AuditListRow => ({ ...r, actorName, updatedAt: r.createdAt });
  return {
    async list(cursor, limit) {
      const rows = await db
        .select({ entry: auditLog, actorName: users.displayName })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.actorUserId))
        .where(afterCursor(auditLog.createdAt, auditLog.id, cursor))
        .orderBy(...newestFirst(auditLog.createdAt, auditLog.id))
        .limit(limit);
      return rows.map((r) => out(r.entry, r.actorName));
    },
    async get(id) {
      const [row] = await db
        .select({ entry: auditLog, actorName: users.displayName })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.actorUserId))
        .where(eq(auditLog.id, id))
        .limit(1);
      return row ? out(row.entry, row.actorName) : null;
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
      ja: "管理画面での変更や、ログインに関わる大切な操作の記録です。誰が・何を・どれに・いつ、をIDで残します。名前は記録に書かず、表示するときにアカウントから読みます（アカウントを消すと名前は出なくなります）。管理者・編集者のログイン／ログアウトも残ります。新しいものが上です。",
      en: "A record of changes made in the admin and of important sign-in actions: who did what to which item, and when, by ID. Names are not written into the log; they are read from the account when shown (gone once the account is deleted). Admin and editor logins and logouts are recorded too. Newest first.",
    },
    titleField: "action",
    fields: [
      text("action", "操作", "Action"),
      text("targetType", "対象の種類", "Kind of item", { ja: "{value}", en: "{value}" }),
      text("targetId", "対象のID", "Item ID", { ja: "対象 {value}", en: "Item {value}" }),
      text("actorName", "操作した人の名前", "Done by (name)", { ja: "{value}", en: "{value}" }),
      text("actorUserId", "操作した人のID", "Done by (account ID)"),
      { name: "createdAt", kind: "datetime", label: { ja: "日時", en: "When" }, readOnly: true, inList: {} },
    ],
  },
};
