import { and, eq, isNull, sql } from "drizzle-orm";
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
import { otpCodes, sessions, users } from "../db/schema";

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
  /** Set by an admin (see restrict): the account can look but not take part. The reason is for admins only. */
  restrictedAt: Date | null;
  restrictedUntil: Date | null;
  restrictionReason: string | null;
  /** The owner (or an admin) asked for the account to be deleted; it goes after the grace period. */
  deletionRequestedAt: Date | null;
  /** True while a restriction is in force (set and not ended). */
  restricted: boolean;
  deletionPending: boolean;
}

/** What an admin sends to restrict an account. `until` null: until an admin lifts it. */
export interface Restriction {
  reason: string;
  until: Date | null;
}

const isRestricted = (r: { restrictedAt: Date | null; restrictedUntil: Date | null }, now = new Date()) => r.restrictedAt !== null && (r.restrictedUntil === null || r.restrictedUntil > now);
type Stored = Omit<UserListRow, "restricted" | "deletionPending">;
const shape = (r: Stored): UserListRow => ({ ...r, restricted: isRestricted(r), deletionPending: r.deletionRequestedAt !== null });

/** What an admin may change on an account: only its role (and only with a fresh login). */
export const USER_FIELDS = { role: t.Union([t.Literal("participant"), t.Literal("editor"), t.Literal("admin")]) };

export interface UserListStore extends ListReadStore<UserListRow> {
  /**
   * Set the role if the editor's copy is current, end every session of that account (so the new role's session
   * rules apply at once, and a removed admin is signed out), and audit it, all in one transaction.
   */
  setRole(actor: string, id: string, expected: Date, role: Role): Promise<UserListRow | "conflict" | null>;
  /** Restrict, lift, ask for deletion after the grace period, cancel that: each audited with the change. Null: no such account. */
  restrict(actor: string, id: string, restriction: Restriction): Promise<UserListRow | null>;
  lift(actor: string, id: string): Promise<UserListRow | null>;
  requestDeletion(actor: string, id: string): Promise<UserListRow | null>;
  cancelDeletion(actor: string, id: string): Promise<UserListRow | null>;
  /** Delete the account and what hangs on it now (stamps, sessions, passkeys, comments). False: no such account. */
  deleteNow(actor: string, id: string): Promise<boolean>;
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
  restrictedAt: users.restrictedAt,
  restrictedUntil: users.restrictedUntil,
  restrictionReason: users.restrictionReason,
  deletionRequestedAt: users.deletionRequestedAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export function createDrizzleUserListStore(db: Db): UserListStore {
  return {
    async list(cursor, limit) {
      return (await db.select(columns).from(users).where(afterCursor(users.createdAt, users.id, cursor)).orderBy(...newestFirst(users.createdAt, users.id)).limit(limit)).map(shape);
    },
    async get(id) {
      const [row] = await db.select(columns).from(users).where(eq(users.id, id)).limit(1);
      return row ? shape(row) : null;
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
        return shape(row);
      });
    },
    restrict: (actor, id, { reason, until }) => change(db, actor, id, "user.restrict", { restrictedAt: sql`now()`, restrictedUntil: until, restrictionReason: reason }),
    lift: (actor, id) => change(db, actor, id, "user.restriction_lift", { restrictedAt: null, restrictedUntil: null, restrictionReason: null }),
    // Only a real change counts, so two requests at once write one audit row.
    requestDeletion: (actor, id) => change(db, actor, id, "user.deletion_request_by_admin", { deletionRequestedAt: sql`now()` }, isNull(users.deletionRequestedAt)),
    cancelDeletion: (actor, id) => change(db, actor, id, "user.deletion_cancel_by_admin", { deletionRequestedAt: null }),
    async deleteNow(actor, id) {
      return db.transaction(async (tx) => {
        const [gone] = await tx.delete(users).where(eq(users.id, id)).returning({ id: users.id, email: users.email });
        if (!gone) return false;
        // Login codes are kept by email, not user id, so no foreign key removes them.
        if (gone.email) await tx.delete(otpCodes).where(eq(otpCodes.email, gone.email.toLowerCase()));
        // Ids only: the audit log keeps rows for good and holds no personal data.
        await writeAudit(tx, { actorUserId: actor, action: "user.deleted_by_admin", targetId: id });
        return true;
      });
    },
  };
}

/** One audited change to an account's own columns; the row after it (or as it was, when `only` found no change to make). */
async function change(db: Db, actor: string, id: string, action: "user.restrict" | "user.restriction_lift" | "user.deletion_request_by_admin" | "user.deletion_cancel_by_admin", set: Record<string, unknown>, only?: ReturnType<typeof isNull>): Promise<UserListRow | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx.update(users).set({ ...set, updatedAt: sql`clock_timestamp()` }).where(only ? and(eq(users.id, id), only) : eq(users.id, id)).returning(columns);
    if (!row) {
      const [current] = await tx.select(columns).from(users).where(eq(users.id, id)).limit(1);
      return current ? shape(current) : null;
    }
    await writeAudit(tx, { actorUserId: actor, action, targetId: id });
    return shape(row);
  });
}

/** The in-memory twin: `endedSessions` lists the accounts whose sessions a role change ended. */
export function createMemoryUserListStore(audit: AuditWriter) {
  const rows = new Map<string, UserListRow>();
  const endedSessions: string[] = [];
  const deleted: string[] = [];
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
    async restrict(actor, id, { reason, until }) {
      return edit(actor, id, "user.restrict", { restrictedAt: new Date(), restrictedUntil: until, restrictionReason: reason });
    },
    async lift(actor, id) {
      return edit(actor, id, "user.restriction_lift", { restrictedAt: null, restrictedUntil: null, restrictionReason: null });
    },
    async requestDeletion(actor, id) {
      return edit(actor, id, "user.deletion_request_by_admin", { deletionRequestedAt: new Date() }, (r) => r.deletionRequestedAt === null);
    },
    async cancelDeletion(actor, id) {
      return edit(actor, id, "user.deletion_cancel_by_admin", { deletionRequestedAt: null });
    },
    async deleteNow(actor, id) {
      if (!rows.delete(id)) return false;
      deleted.push(id);
      await audit.record({ actorUserId: actor, action: "user.deleted_by_admin", targetId: id });
      return true;
    },
  };
  async function edit(actor: string, id: string, action: Parameters<typeof audit.record>[0]["action"], set: Partial<UserListRow>, only?: (r: UserListRow) => boolean): Promise<UserListRow | null> {
    const cur = rows.get(id);
    if (!cur) return null;
    if (only && !only(cur)) return cur;
    const next = { ...cur, ...set, updatedAt: new Date(cur.updatedAt.getTime() + ++tick) };
    const row = { ...next, restricted: isRestricted(next), deletionPending: next.deletionRequestedAt !== null };
    rows.set(id, row);
    await audit.record({ actorUserId: actor, action, targetId: id });
    return row;
  }
  return { store, rows, endedSessions, deleted };
}

export type UserListService = ListReader<UserListRow> & {
  setRole(actor: string, id: string, expected: Date | string, role: Role): Promise<Result<UserListRow>>;
  restrict(actor: string, id: string, restriction: { reason: string; until: Date | string | null }): Promise<Result<UserListRow>>;
  lift(actor: string, id: string): Promise<Result<UserListRow>>;
  requestDeletion(actor: string, id: string): Promise<Result<UserListRow>>;
  cancelDeletion(actor: string, id: string): Promise<Result<UserListRow>>;
  deleteNow(actor: string, id: string): Promise<Result<true>>;
};

/** The users list, and the one change it allows. Nobody changes their own role, so the last admin cannot lock everyone out. */
export function createUserListService(deps: { store: UserListStore; now?: () => Date }): UserListService {
  const { store } = deps;
  const now = deps.now ?? (() => new Date());
  /** Restricting or deleting: not your own account (the last admin cannot lock themselves out) and not an admin (change the role first). */
  const target = async (actor: string, id: string): Promise<Result<UserListRow>> => {
    if (actor === id) return bad("cannot_manage_self");
    const row = await store.get(id);
    if (!row) return bad("not_found");
    return row.role === "admin" ? bad("cannot_manage_admin") : ok(row);
  };
  const act = async (actor: string, id: string, run: () => Promise<UserListRow | null>): Promise<Result<UserListRow>> => {
    const t = await target(actor, id);
    if (!t.ok) return t;
    const row = await run();
    return row ? ok(row) : bad("not_found");
  };
  return {
    ...createListReader({ store }),
    async setRole(actor, id, expected, role) {
      if (actor === id) return bad("cannot_change_own_role");
      const r = await store.setRole(actor, id, expected instanceof Date ? expected : new Date(expected), role);
      return r === null ? bad("not_found") : r === "conflict" ? bad("conflict") : ok(r);
    },
    async restrict(actor, id, { reason, until }) {
      const end = until === null ? null : new Date(until);
      const text = reason.trim();
      // A reason is required (the admin who looks later should know why), and an end in the past would restrict nothing.
      if (text === "" || (end !== null && (Number.isNaN(end.getTime()) || end <= now()))) return bad("validation_failed");
      return act(actor, id, () => store.restrict(actor, id, { reason: text, until: end }));
    },
    lift: (actor, id) => act(actor, id, () => store.lift(actor, id)),
    requestDeletion: (actor, id) => act(actor, id, () => store.requestDeletion(actor, id)),
    cancelDeletion: (actor, id) => act(actor, id, () => store.cancelDeletion(actor, id)),
    async deleteNow(actor, id) {
      const t = await target(actor, id);
      if (!t.ok) return t;
      return (await store.deleteNow(actor, id)) ? ok(true) : bad("not_found");
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
    titleFrom: ["displayName", "email"],
    fields: [
      { name: "publicId", kind: "text", label: { ja: "会員番号", en: "Member ID" }, readOnly: true },
      { name: "email", kind: "text", label: { ja: "メール", en: "Email" }, readOnly: true },
      { name: "displayName", kind: "text", label: { ja: "名前", en: "Name" }, readOnly: true },
      {
        name: "role",
        kind: "select",
        label: { ja: "権限", en: "Permission" },
        options: [
          { value: "participant", label: { ja: "参加者", en: "Participant" } },
          { value: "editor", label: { ja: "編集者", en: "Editor" } },
          { value: "admin", label: { ja: "管理者", en: "Administrator" }, tone: "info" },
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
      ], inList: { empty: { ja: "未回答", en: "Not answered" } } },
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
      ] },
      { name: "foundVia", kind: "select", readOnly: true, label: { ja: "知ったきっかけ", en: "How they found it" }, options: [
        { value: "qr_or_sign", label: { ja: "QRコード・看板", en: "QR code or sign" } },
        { value: "flyer", label: { ja: "チラシ・ポスター", en: "Flyer or poster" } },
        { value: "tourism_site", label: { ja: "観光サイト", en: "Tourism website" } },
        { value: "sns", label: { ja: "SNS", en: "Social media" } },
        { value: "search", label: { ja: "検索", en: "Web search" } },
        { value: "friend", label: { ja: "友人・知人", en: "Friend or acquaintance" } },
        { value: "other", label: { ja: "その他", en: "Other" } },
      ] },
      { name: "createdAt", kind: "datetime", label: { ja: "登録した日", en: "Registered" }, readOnly: true, inList: {} },
      { name: "restricted", kind: "boolean", label: { ja: "制限", en: "Restricted" }, readOnly: true, inList: { yes: { ja: "制限中", en: "Restricted" }, tone: { yes: "bad" } } },
      { name: "deletionPending", kind: "boolean", label: { ja: "削除の予約", en: "Deletion" }, readOnly: true, inList: { yes: { ja: "削除待ち", en: "Will be deleted" }, tone: { yes: "warn" } } },
      { name: "restrictionReason", kind: "text", label: { ja: "制限の理由", en: "Restriction reason" }, readOnly: true },
      { name: "restrictedUntil", kind: "datetime", label: { ja: "制限の終わり", en: "Restricted until" }, readOnly: true },
    ],
  },
};
