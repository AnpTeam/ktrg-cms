import { Elysia, t } from "elysia";
import { rowOut, type ReadDef } from "../admin-lists/list-routes";
import { createListReader, type ListReader } from "../admin-lists/list-service";
import { memoryReader } from "../admin-lists/list-memory-store";
import { bad, ok, type ListReadStore, type ListRow, type Result } from "../admin-lists/list-types";
import type { AuditWriter } from "../audit/audit-log";
import { fail } from "../auth/http";
import { can, type Role } from "../auth/permissions";
import { routeKit, type KitServices, type RouteOptions } from "../auth/route-kit";
import { oneOf, uuidParams } from "../lib/schemas";

/**
 * Comments under a blog post. Only a signed-in account can write one. A comment from a participant is held (`pending`)
 * until someone on the staff approves it in 管理 > コメント; one from the staff shows at once. `hidden` keeps a comment
 * but does not show it. Visitors read only the approved ones.
 */
export const COMMENT_STATUSES = ["pending", "approved", "hidden"] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];
export const COMMENT_MAX = 1000;

export interface CommentRow extends ListRow {
  postId: string;
  /** The post's Japanese title, for the staff's list. */
  postTitle: string;
  /** The post's cover photo, a small picture beside the comment in the staff's list; null when it has none. */
  postPhotoUrl: string | null;
  /** The writer's profile name; null when they have none or the account is gone. */
  authorName: string | null;
  body: string;
  status: CommentStatus;
}

export interface CommentStore extends ListReadStore<CommentRow> {
  create(userId: string, postId: string, body: string, status: CommentStatus): Promise<CommentRow>;
  /** Sets the status if the editor's copy is current; null when there is no such comment. */
  setStatus(actor: string, id: string, expected: Date, status: CommentStatus): Promise<CommentRow | "conflict" | null>;
  remove(actor: string, id: string): Promise<boolean>;
  /** The approved comments of one post, oldest first. */
  listApproved(postId: string, limit: number): Promise<CommentRow[]>;
}

export const COMMENT_AUDIT = { update: "comment.update", delete: "comment.delete" } as const;
export const PUBLIC_COMMENTS_LIMIT = 100;

export type CommentService = ReturnType<typeof createCommentService>;

export function createCommentService(deps: { store: CommentStore; postVisible: (postId: string) => Promise<boolean> }) {
  const reader: ListReader<CommentRow> = createListReader({ store: deps.store });
  return {
    ...reader,
    approved: (postId: string) => deps.store.listApproved(postId, PUBLIC_COMMENTS_LIMIT),
    /** Writes a comment under a post a visitor may read; the staff's go live at once, everyone else's wait. */
    async add(userId: string, role: Role, postId: string, text: string): Promise<Result<CommentRow>> {
      const body = text.trim();
      if (body === "" || body.length > COMMENT_MAX) return bad("validation_failed");
      if (!(await deps.postVisible(postId))) return bad("not_found");
      return ok(await deps.store.create(userId, postId, body, can(role, "post.manage") ? "approved" : "pending"));
    },
    async setStatus(actor: string, id: string, expected: string, status: CommentStatus): Promise<Result<CommentRow>> {
      const r = await deps.store.setStatus(actor, id, new Date(expected), status);
      return r === null ? bad("not_found") : r === "conflict" ? bad("conflict") : ok(r);
    },
    async remove(actor: string, id: string): Promise<Result<true>> {
      return (await deps.store.remove(actor, id)) ? ok(true as const) : bad("not_found");
    },
  };
}

/** In-memory comments for tests and the dev page. */
export function createMemoryCommentStore(audit: AuditWriter, opts: { now?: () => Date; names?: Map<string, string>; titles?: Map<string, string> } = {}) {
  const rows = new Map<string, CommentRow>();
  const now = opts.now ?? (() => new Date());
  let tick = 0;
  const stamp = () => new Date(now().getTime() + ++tick);
  const store: CommentStore = {
    ...memoryReader(rows),
    async create(userId, postId, body, status) {
      const at = stamp();
      const row: CommentRow = { id: crypto.randomUUID(), postId, postTitle: opts.titles?.get(postId) ?? "", postPhotoUrl: null, authorName: opts.names?.get(userId) ?? null, body, status, createdAt: at, updatedAt: at };
      rows.set(row.id, row);
      return row;
    },
    async setStatus(actor, id, expected, status) {
      const cur = rows.get(id);
      if (!cur) return null;
      if (cur.updatedAt.getTime() !== expected.getTime()) return "conflict";
      const row = { ...cur, status, updatedAt: stamp() };
      rows.set(id, row);
      await audit.record({ actorUserId: actor, action: COMMENT_AUDIT.update, targetId: id });
      return row;
    },
    async remove(actor, id) {
      if (!rows.delete(id)) return false;
      await audit.record({ actorUserId: actor, action: COMMENT_AUDIT.delete, targetId: id });
      return true;
    },
    async listApproved(postId, limit) {
      return [...rows.values()].filter((c) => c.postId === postId && c.status === "approved").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(0, limit);
    },
  };
  return { store, rows };
}

export interface CommentServices extends KitServices {
  comments: CommentService;
}

const STATUS_FIELD = oneOf(COMMENT_STATUSES);

/** The comments as an admin list (`post.manage`): read the held ones, approve, hide or delete. Writes are in commentAdminRoutes. */
export const commentList: ReadDef<"comments", CommentRow, CommentServices> & { fields: { status: typeof STATUS_FIELD } } = {
  key: "comments",
  permission: "post.manage",
  service: (s) => s.comments,
  fields: { status: STATUS_FIELD },
  ops: { create: false, edit: true, delete: true },
  ui: {
    title: { ja: "コメント", en: "Comments" },
    intro: {
      ja: "ブログの記事へのコメントです。登録した人のコメントは、「公開する」にするまで表示されません。スタッフのコメントはすぐに表示されます。",
      en: "Comments on blog posts. A signed-in visitor's comment stays hidden until you set it to Show. The staff's own comments show at once.",
    },
    deleteWarning: { ja: "このコメントを削除します。よろしいですか？", en: "Delete this comment?" },
    titleField: "body",
    fields: [
      { name: "body", kind: "text", label: { ja: "コメント", en: "Comment" }, readOnly: true },
      { name: "postTitle", kind: "text", label: { ja: "記事", en: "Post" }, readOnly: true, inList: { text: { ja: "記事：{value}", en: "Post: {value}" } } },
      { name: "authorName", kind: "text", label: { ja: "書いた人", en: "Written by" }, readOnly: true, inList: { text: { ja: "{value}", en: "{value}" }, empty: { ja: "名前なし", en: "No name" } } },
      {
        name: "status",
        kind: "select",
        label: { ja: "いまの状態", en: "Status" },
        options: [
          { value: "pending", label: { ja: "確認待ち", en: "Waiting" } },
          { value: "approved", label: { ja: "公開する", en: "Show" } },
          { value: "hidden", label: { ja: "非表示", en: "Hidden" } },
        ],
        required: true,
        inList: {},
      },
    ],
  },
};

/** Staff: set a comment's status, or delete it. The same shapes as every list's change, so the generated form saves here. */
export function commentAdminRoutes(getServices: () => CommentServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  return new Elysia({ prefix: "/admin/lists/comments", detail: { tags: ["Admin lists"] } })
    .use(plugins)
    .patch(
      "/:id",
      async ({ user, params, body, set }) => {
        const r = await getServices().comments.setStatus(user.id, params.id, body.updatedAt, body.status);
        return r.ok ? { ok: true as const, item: rowOut(r.value) } : fail(set, r.reason === "not_found" ? 404 : r.reason === "conflict" ? 409 : 400, r.reason);
      },
      { auth: commentList.permission, rateLimit: { adminWriteUser: "user.id" }, params: uuidParams, body: t.Object({ updatedAt: t.String({ format: "date-time" }), status: STATUS_FIELD }) },
    )
    .delete(
      "/:id",
      async ({ user, params, set }) => {
        const r = await getServices().comments.remove(user.id, params.id);
        return r.ok ? { ok: true as const } : fail(set, 404, "not_found");
      },
      { auth: commentList.permission, rateLimit: { adminWriteUser: "user.id" }, params: uuidParams },
    );
}

/** What visitors get: a post's approved comments (no login), and writing one (signed in). */
export function publicCommentRoutes(getServices: () => CommentServices, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  const out = (c: CommentRow) => ({ id: c.id, body: c.body, authorName: c.authorName, createdAt: c.createdAt.toISOString() });
  return new Elysia({ detail: { tags: ["Content"] } })
    .use(plugins)
    .get("/posts/:id/comments", async ({ params }) => ({ ok: true as const, comments: (await getServices().comments.approved(params.id)).map(out) }), { params: uuidParams })
    .post(
      "/posts/:id/comments",
      async ({ user, params, body, set }) => {
        const r = await getServices().comments.add(user.id, user.role, params.id, body.body);
        if (!r.ok) return fail(set, r.reason === "not_found" ? 404 : 422, r.reason);
        set.status = 201;
        // `held`: it is waiting for approval, so the page says so instead of showing it.
        return { ok: true as const, held: r.value.status !== "approved", comment: r.value.status === "approved" ? out(r.value) : null };
      },
      { auth: "comment.create", rateLimit: { commentUser: "user.id" }, params: uuidParams, body: t.Object({ body: t.String({ maxLength: COMMENT_MAX + 200 }) }) },
    );
}
