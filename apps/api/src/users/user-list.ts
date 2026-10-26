import { and, eq, sql } from "drizzle-orm";
import { t } from "elysia";
import type { ReadDef } from "../admin-lists/list-routes";
import { createListReader, type ListReader } from "../admin-lists/list-service";
import { afterCursor, newestFirst, sameInstant } from "../admin-lists/list-sql";
import { memoryReader } from "../admin-lists/list-memory-store";
import { bad, ok, type ListReadStore, type ListRow, type Result } from "../admin-lists/list-types";
import type { AuditWriter } from "../audit/audit-log";
import { writeAudit } from "../audit/audit-store";
import type { KitServices } from "../auth/route-kit";
import type { AgeRange, FoundVia, Gender, Origin, Role } from "../auth/user";
import type { Db } from "../db/client";
import { sessions, users } from "../db/schema";

/** An account as the users list shows it. */
export interface UserListRow extends ListRow {
  publicId: string;
  /** Null for an account made with a passkey alone. */
  email: string | null;
  displayName: string | null;
  role: Role;
  /** What they chose to say about themselves (all optional; null = not answered). */
  origin: Origin | null;
  ageRange: AgeRange | null;
  gender: Gender | null;
  foundVia: FoundVia | null;
}

/** What an admin may change on an account: only its role (and only with a fresh login). */
export const USER_FIELDS = { role: t.Union([t.Literal("participant"), t.Literal("editor"), t.Literal("admin")]) };

export interface UserListStore extends ListReadStore<UserListRow> {
  /**
   * Set the role if the editor's copy is current, end every session of that account (so the new role's session
   * rules apply at once, and a removed admin is signed out), and audit it, all in one transaction.
   */
  setRole(actor: string, id: string, expected: Date, role: Role): Promise<UserListRow | "conflict" | null>;
}

const columns = {
  id: users.id,
  publicId: users.publicId,
  email: users.email,
  displayName: users.displayName,
  role: users.role,
  origin: users.origin,
  ageRange: users.ageRange,
  gender: users.gender,
  foundVia: users.foundVia,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export function createDrizzleUserListStore(db: Db): UserListStore {
  return {
    async list(cursor, limit) {
      return db.select(columns).from(users).where(afterCursor(users.createdAt, users.id, cursor)).orderBy(...newestFirst(users.createdAt, users.id)).limit(limit);
    },
    async get(id) {
      const [row] = await db.select(columns).from(users).where(eq(users.id, id)).limit(1);
      return row ?? null;
    },
    async setRole(actor, id, expected, role) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(users)
          .set({ role, updatedAt: sql`clock_timestamp()` })
          .where(and(eq(users.id, id), sameInstant(users.updatedAt, expected)))
          .returning(columns);
        if (!row) {
          const [exists] = await tx.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
          return exists ? "conflict" : null;
        }
        await tx.delete(sessions).where(eq(sessions.userId, id));
        await writeAudit(tx, { actorUserId: actor, action: "user.role.change", targetId: id });
        return row;
      });
    },
  };
}

/** The in-memory twin: `endedSessions` lists the accounts whose sessions a role change ended. */
export function createMemoryUserListStore(audit: AuditWriter) {
  const rows = new Map<string, UserListRow>();
  const endedSessions: string[] = [];
  let tick = 0;
  const store: UserListStore = {
    ...memoryReader(rows),
    async setRole(actor, id, expected, role) {
      const cur = rows.get(id);
      if (!cur) return null;
      if (cur.updatedAt.getTime() !== expected.getTime()) return "conflict";
      const row = { ...cur, role, updatedAt: new Date(cur.updatedAt.getTime() + ++tick) };
      rows.set(id, row);
      endedSessions.push(id);
      await audit.record({ actorUserId: actor, action: "user.role.change", targetId: id });
      return row;
    },
  };
  return { store, rows, endedSessions };
}

export type UserListService = ListReader<UserListRow> & {
  setRole(actor: string, id: string, expected: Date | string, role: Role): Promise<Result<UserListRow>>;
};

/** The users list, and the one change it allows. Nobody changes their own role, so the last admin cannot lock everyone out. */
export function createUserListService(deps: { store: UserListStore }): UserListService {
  const { store } = deps;
  return {
    ...createListReader({ store }),
    async setRole(actor, id, expected, role) {
      if (actor === id) return bad("cannot_change_own_role");
      const r = await store.setRole(actor, id, expected instanceof Date ? expected : new Date(expected), role);
      return r === null ? bad("not_found") : r === "conflict" ? bad("conflict") : ok(r);
    },
  };
}

export interface UserListServices extends KitServices {
  userList: UserListService;
}

/**
 * Accounts as an admin list (`user.read`), newest first. The form shows the account and changes its role;
 * the change needs a fresh login (FRESH_LOGIN_REQUIRED), and saving goes to user-routes.ts, not the generic writes.
 */
export const userList: ReadDef<"users", UserListRow, UserListServices> & { fields: typeof USER_FIELDS } = {
  key: "users",
  permission: "user.read",
  service: (s) => s.userList,
  fields: USER_FIELDS,
  ops: { create: false, edit: true, delete: false },
  ui: {
    title: { ja: "ユーザーと権限", en: "Users and permissions" },
    intro: {
      ja: "登録したアカウントです。権限を変えるには、もう一度本人確認が必要です。自分の権限は変えられません。権限を変えると、その人はログアウトされます。",
      en: "Registered accounts. Changing a permission asks you to confirm it is you again. You cannot change your own. The account is signed out when its permission changes.",
    },
    titleField: "publicId",
    fields: [
      { name: "publicId", kind: "text", label: { ja: "会員番号", en: "Member ID" }, readOnly: true },
      { name: "email", kind: "text", label: { ja: "メール", en: "Email" }, readOnly: true, inList: { empty: { ja: "メールなし", en: "No email" } } },
      { name: "displayName", kind: "text", label: { ja: "名前", en: "Name" }, readOnly: true, inList: {} },
      {
        name: "role",
        kind: "select",
        label: { ja: "権限", en: "Permission" },
        options: [
          { value: "participant", label: { ja: "参加者", en: "Participant" } },
          { value: "editor", label: { ja: "編集者", en: "Editor" } },
          { value: "admin", label: { ja: "管理者", en: "Administrator" } },
        ],
        required: true,
        inList: {},
      },
      { name: "origin", kind: "select", readOnly: true, label: { ja: "お住まい", en: "Where from" }, options: [
        { value: "osaka", label: { ja: "大阪府", en: "Osaka" } },
        { value: "wakayama", label: { ja: "和歌山県", en: "Wakayama" } },
        { value: "nara", label: { ja: "奈良県", en: "Nara" } },
        { value: "other_japan", label: { ja: "日本のほかの地域", en: "Elsewhere in Japan" } },
        { value: "overseas", label: { ja: "海外", en: "Overseas" } },
      ], inList: { empty: { ja: "お住まい：未回答", en: "Where from: not answered" } } },
      { name: "ageRange", kind: "select", readOnly: true, label: { ja: "年代", en: "Age" }, options: [
        { value: "under20", label: { ja: "20歳未満", en: "Under 20" } },
        { value: "20s", label: { ja: "20代", en: "20s" } },
        { value: "30s", label: { ja: "30代", en: "30s" } },
        { value: "40s", label: { ja: "40代", en: "40s" } },
        { value: "50s", label: { ja: "50代", en: "50s" } },
        { value: "60s", label: { ja: "60代", en: "60s" } },
        { value: "70plus", label: { ja: "70歳以上", en: "70 and over" } },
      ], inList: {} },
      { name: "gender", kind: "select", readOnly: true, label: { ja: "性別", en: "Gender" }, options: [
        { value: "female", label: { ja: "女性", en: "Female" } },
        { value: "male", label: { ja: "男性", en: "Male" } },
        { value: "other", label: { ja: "その他", en: "Other" } },
        { value: "unspecified", label: { ja: "答えたくない", en: "Prefer not to say" } },
      ], inList: {} },
      { name: "foundVia", kind: "select", readOnly: true, label: { ja: "知ったきっかけ", en: "How they found it" }, options: [
        { value: "qr_or_sign", label: { ja: "QRコード・看板", en: "QR code or sign" } },
        { value: "flyer", label: { ja: "チラシ・ポスター", en: "Flyer or poster" } },
        { value: "tourism_site", label: { ja: "観光サイト", en: "Tourism website" } },
        { value: "sns", label: { ja: "SNS", en: "Social media" } },
        { value: "search", label: { ja: "検索", en: "Web search" } },
        { value: "friend", label: { ja: "友人・知人", en: "Friend or acquaintance" } },
        { value: "other", label: { ja: "その他", en: "Other" } },
      ], inList: {} },
      { name: "createdAt", kind: "datetime", label: { ja: "登録した日時", en: "Registered" }, readOnly: true },
    ],
  },
};
