import { describe, expect, test } from "bun:test";
import { getTableColumns } from "drizzle-orm";
import { auditLog } from "../db/schema";
import { AUDIT_ACTIONS, auditRow, createMemoryAuditWriter, type AuditAction } from "./audit-log";

const actor = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";

describe("the audit action list", () => {
  test("every action is dotted lowercase and acts on a known kind of thing", () => {
    for (const [action, targetType] of Object.entries(AUDIT_ACTIONS)) {
      expect(action).toMatch(/^[a-z_]+(\.[a-z_]+)+$/);
      expect(["user", "passkey", "route", "spot", "upload", "rally", "notice", "banner", "place"]).toContain(targetType);
    }
  });

  test("the audit_log table has no column that could hold personal data", () => {
    // ids, an action name, a target type and a time. Nothing free-form.
    expect(Object.keys(getTableColumns(auditLog)).sort()).toEqual(
      ["action", "actorUserId", "createdAt", "id", "targetId", "targetType"].sort(),
    );
  });
});

describe("auditRow", () => {
  test("fills the target type from the action list", () => {
    expect(auditRow({ actorUserId: actor, action: "passkey.remove", targetId: target })).toEqual({
      actorUserId: actor,
      action: "passkey.remove",
      targetType: "passkey",
      targetId: target,
    });
  });

  test("a null actor (the system) and a null target are allowed", () => {
    expect(auditRow({ actorUserId: null, action: "session.reauth", targetId: null })).toMatchObject({
      actorUserId: null,
      targetId: null,
    });
  });

  test("refuses an email, a name or any other non-id, and never repeats it in the error", () => {
    for (const pii of ["someone@example.com", "Taro Yamada", "192.168.0.1", "", "user-1"]) {
      for (const entry of [
        { actorUserId: pii, action: "passkey.add" as const, targetId: target },
        { actorUserId: actor, action: "passkey.add" as const, targetId: pii },
      ]) {
        let message = "";
        try {
          auditRow(entry);
        } catch (err) {
          message = (err as Error).message;
        }
        expect(message).toMatch(/must be a UUID/);
        if (pii) expect(message).not.toContain(pii);
      }
    }
  });

  test("refuses an action that is not in the list", () => {
    expect(() => auditRow({ actorUserId: actor, action: "user.delete" as AuditAction, targetId: null })).toThrow(
      /unknown action/,
    );
    expect(() => auditRow({ actorUserId: actor, action: "constructor" as AuditAction, targetId: null })).toThrow(
      /unknown action/,
    );
  });
});

describe("createMemoryAuditWriter", () => {
  test("keeps checked rows, and refuses bad ones the same way", async () => {
    const { writer, rows } = createMemoryAuditWriter();
    await writer.record({ actorUserId: actor, action: "passkey.add", targetId: target });
    await expect(writer.record({ actorUserId: "a@b.c", action: "passkey.add", targetId: target })).rejects.toThrow();
    expect(rows).toEqual([{ actorUserId: actor, action: "passkey.add", targetType: "passkey", targetId: target }]);
  });
});
