import { describe, expect, test } from "bun:test";
import { createMemoryAuditWriter } from "../audit/audit-log";
import { COMMENT_MAX, createCommentService, createMemoryCommentStore } from "./comments";

const reader = "11111111-1111-4111-8111-111111111111";
const staff = "22222222-2222-4222-8222-222222222222";
const post = "33333333-3333-4333-8333-333333333333";

function setup() {
  const audit = createMemoryAuditWriter();
  const mem = createMemoryCommentStore(audit.writer, { names: new Map([[reader, "山田"]]) });
  const svc = createCommentService({ store: mem.store, postVisible: async (id) => id === post });
  return { svc, audit };
}

describe("blog comments", () => {
  test("a participant's comment waits; the staff's shows; visitors read only the approved ones", async () => {
    const { svc } = setup();
    const held = await svc.add(reader, "participant", post, "  よい記事です  ");
    expect(held.ok && held.value).toMatchObject({ body: "よい記事です", status: "pending", authorName: "山田" });
    expect((await svc.approved(post)).length).toBe(0);
    const own = await svc.add(staff, "editor", post, "ありがとう");
    expect(own.ok && own.value.status).toBe("approved");
    expect((await svc.approved(post)).map((c) => c.body)).toEqual(["ありがとう"]);
  });

  test("approving a held comment shows it; hiding takes it down; a stale copy is a conflict; deleting is audited", async () => {
    const { svc, audit } = setup();
    const held = await svc.add(reader, "participant", post, "hello");
    if (!held.ok) throw new Error("not made");
    const shown = await svc.setStatus(staff, held.value.id, held.value.updatedAt.toISOString(), "approved");
    expect(shown.ok && shown.value.status).toBe("approved");
    expect((await svc.approved(post)).length).toBe(1);
    expect(await svc.setStatus(staff, held.value.id, held.value.updatedAt.toISOString(), "hidden")).toEqual({ ok: false, reason: "conflict" });
    if (!shown.ok) throw new Error();
    await svc.setStatus(staff, held.value.id, shown.value.updatedAt.toISOString(), "hidden");
    expect((await svc.approved(post)).length).toBe(0);
    expect((await svc.remove(staff, held.value.id)).ok).toBe(true);
    expect(audit.rows.map((r) => r.action)).toEqual(["comment.update", "comment.update", "comment.delete"]);
  });

  test("empty, too long, or under a post nobody may read: refused", async () => {
    const { svc } = setup();
    expect(await svc.add(reader, "participant", post, "   ")).toMatchObject({ ok: false });
    expect(await svc.add(reader, "participant", post, "x".repeat(COMMENT_MAX + 1))).toMatchObject({ ok: false });
    expect(await svc.add(reader, "participant", "44444444-4444-4444-8444-444444444444", "hi")).toEqual({ ok: false, reason: "not_found" });
  });
});
