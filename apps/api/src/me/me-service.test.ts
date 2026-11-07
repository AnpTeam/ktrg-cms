import { describe, expect, test } from "bun:test";
import type { AuthUser } from "../auth/user";
import type { Mailer, MailMessage } from "../lib/mailer";
import { createMemoryMeStore } from "./me-memory-store";
import { DISPLAY_NAME_MAX, createMeService, normalizeDisplayName } from "./me-service";

const alice: AuthUser = { id: "11111111-1111-4111-8111-111111111111", email: "alice@example.com", role: "participant", locale: "en" };
const passkeyOnly: AuthUser = { id: "22222222-2222-4222-8222-222222222222", email: null, role: "participant", locale: "ja" };

function setup(opts: { mailFails?: boolean } = {}) {
  const users = new Map<string, AuthUser>([
    [alice.id, { ...alice }],
    [passkeyOnly.id, { ...passkeyOnly }],
  ]);
  const mem = createMemoryMeStore(users);
  const sent: MailMessage[] = [];
  const logs: string[] = [];
  const mailer: Mailer = {
    async send(m) {
      if (opts.mailFails) throw new Error("<alice@example.com>: Recipient address rejected");
      sent.push(m);
    },
  };
  const clock = new Date("2026-10-15T05:30:00Z");
  const service = createMeService({ store: mem.store, mailer, now: () => clock, log: (l) => logs.push(l) });
  return { service, users, sent, logs, audit: mem.audit };
}

describe("normalizeDisplayName", () => {
  test("trims and joins whitespace, including line breaks", () => {
    expect(normalizeDisplayName("  Taro \n\t Yamada  ")).toBe("Taro Yamada");
    expect(normalizeDisplayName("山田　太郎")).toBe("山田 太郎"); // full-width space too
  });

  test("empty or only spaces means no name", () => {
    expect(normalizeDisplayName("   ")).toBeNull();
    expect(normalizeDisplayName("")).toBeNull();
    expect(normalizeDisplayName(null)).toBeNull();
  });

  test(`at most ${DISPLAY_NAME_MAX} characters, counted as people see them`, () => {
    expect(normalizeDisplayName("あ".repeat(DISPLAY_NAME_MAX))).toBe("あ".repeat(DISPLAY_NAME_MAX));
    expect(normalizeDisplayName("あ".repeat(DISPLAY_NAME_MAX + 1))).toBeUndefined();
    expect(normalizeDisplayName("🏔".repeat(DISPLAY_NAME_MAX))).toBe("🏔".repeat(DISPLAY_NAME_MAX)); // 2 UTF-16 units each
  });

  test("refuses control and text-direction characters that could hide or reorder text", () => {
    for (const bad of ["a\u0000b", "a\u0007b", "admin‮gnp.exe", "a⁦b⁩", "a‏b"]) {
      expect(normalizeDisplayName(bad)).toBeUndefined();
    }
  });

  test("keeps emoji sequences that use joiners", () => {
    expect(normalizeDisplayName("👨‍👩‍👧 family")).toBe("👨‍👩‍👧 family");
  });
});

describe("update", () => {
  test("changes the language and the name", async () => {
    const { service, users } = setup();
    const result = await service.update(alice, { locale: "ja", displayName: "  Alice  " });
    expect(result).toMatchObject({ ok: true, profile: { locale: "ja", displayName: "Alice" } });
    expect(users.get(alice.id)!.locale).toBe("ja"); // the session sees it at once
  });

  test("null or blank clears the name", async () => {
    const { service } = setup();
    await service.update(alice, { displayName: "Alice" });
    expect(await service.update(alice, { displayName: null })).toMatchObject({ ok: true, profile: { displayName: null } });
    await service.update(alice, { displayName: "Alice" });
    expect(await service.update(alice, { displayName: "  " })).toMatchObject({ ok: true, profile: { displayName: null } });
  });

  test("a bad name changes nothing, not even a language sent with it", async () => {
    const { service } = setup();
    expect(await service.update(alice, { locale: "ja", displayName: "x".repeat(99) })).toEqual({
      ok: false,
      reason: "invalid_display_name",
    });
    expect((await service.get(alice))!.locale).toBe("en");
  });

  test("an account that no longer exists", async () => {
    const { service, users } = setup();
    users.delete(alice.id);
    expect(await service.update(alice, { locale: "ja" })).toEqual({ ok: false, reason: "gone" });
  });
});

describe("deletion request", () => {
  test("records it, audits it, and emails the owner in their language", async () => {
    const { service, sent, audit } = setup();
    const profile = await service.requestDeletion(alice);

    expect(profile!.deletionRequestedAt).toEqual(new Date("2026-10-15T05:30:00Z"));
    expect(audit).toEqual([{ actorUserId: alice.id, action: "user.deletion_request", targetType: "user", targetId: alice.id }]);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("alice@example.com");
    expect(sent[0]!.subject).toBe("[Katsuragi Shugen] We received your request to delete your account");
  });

  test("asking again while one is pending changes nothing, sends nothing, audits nothing", async () => {
    const { service, sent, audit } = setup();
    const first = await service.requestDeletion(alice);
    const again = await service.requestDeletion(alice);
    expect(again!.deletionRequestedAt).toEqual(first!.deletionRequestedAt);
    expect(sent).toHaveLength(1);
    expect(audit).toHaveLength(1);
  });

  test("a passkey-only account has no email: recorded, nothing sent", async () => {
    const { service, sent, audit } = setup();
    expect((await service.requestDeletion(passkeyOnly))!.deletionRequestedAt).not.toBeNull();
    expect(sent).toHaveLength(0);
    expect(audit).toHaveLength(1);
  });

  test("a mail failure is logged and the request still stands", async () => {
    const { service, logs } = setup({ mailFails: true });
    expect((await service.requestDeletion(alice))!.deletionRequestedAt).not.toBeNull();
    expect(logs).toEqual(["[me] deletion email failed: Error"]); // the name only: a mail server may echo the address in its message
  });

  test("cancel clears it (audited); cancelling with nothing pending changes nothing", async () => {
    const { service, audit } = setup();
    expect((await service.cancelDeletion(alice))!.deletionRequestedAt).toBeNull();
    expect(audit).toHaveLength(0);

    await service.requestDeletion(alice);
    expect((await service.cancelDeletion(alice))!.deletionRequestedAt).toBeNull();
    expect(audit.map((r) => r.action)).toEqual(["user.deletion_request", "user.deletion_cancel"]);
  });
});

describe("deletion after the grace period", () => {
  const DAY = 24 * 60 * 60 * 1000;

  function clocked() {
    const users = new Map<string, AuthUser>([
      [alice.id, { ...alice }],
      [passkeyOnly.id, { ...passkeyOnly }],
    ]);
    const mem = createMemoryMeStore(users);
    let now = new Date("2026-10-15T05:30:00Z");
    const service = createMeService({ store: mem.store, now: () => now });
    return { service, users, mem, audit: mem.audit, advance: (days: number) => (now = new Date(now.getTime() + days * DAY)) };
  }

  test("an admin's deletion gives a week: still there at 6 days, gone at 7", async () => {
    const { service, advance, mem } = clocked();
    await service.requestDeletion(alice);
    mem.extras.get(alice.id)!.deletionByAdmin = true;
    const profile = await service.get(alice);
    expect(profile!.deletionDueAt!.getTime() - profile!.deletionRequestedAt!.getTime()).toBe(7 * DAY);
    advance(6);
    expect(await service.purgeDue()).toBe(0);
    advance(1);
    expect(await service.purgeDue()).toBe(1);
  });

  test("a request shows the day it will happen: 3 days later", async () => {
    const { service } = clocked();
    const profile = await service.requestDeletion(alice);
    expect(profile!.deletionDueAt!.getTime() - profile!.deletionRequestedAt!.getTime()).toBe(3 * DAY);
    expect((await service.get(passkeyOnly))!.deletionDueAt).toBeNull();
  });

  test("nothing is deleted before 3 days, then the account is deleted and audited by id only", async () => {
    const { service, users, audit, advance } = clocked();
    await service.requestDeletion(alice);
    advance(2.9);
    expect(await service.purgeDue()).toBe(0);
    expect(users.has(alice.id)).toBe(true);

    advance(0.2);
    expect(await service.purgeDue()).toBe(1);
    expect(users.has(alice.id)).toBe(false);
    expect(users.has(passkeyOnly.id)).toBe(true); // nobody else is touched
    expect(audit.at(-1)).toEqual({ actorUserId: null, action: "user.deleted", targetType: "user", targetId: alice.id });
  });

  test("a request cancelled in time is never deleted", async () => {
    const { service, users, advance } = clocked();
    await service.requestDeletion(alice);
    advance(2);
    await service.cancelDeletion(alice);
    advance(5);
    expect(await service.purgeDue()).toBe(0);
    expect(users.has(alice.id)).toBe(true);
  });

  test("every account has its own 8-digit ID", async () => {
    const { service } = clocked();
    const a = (await service.get(alice))!.publicId;
    const b = (await service.get(passkeyOnly))!.publicId;
    expect(a).toMatch(/^\d{8}$/);
    expect(b).toMatch(/^\d{8}$/);
    expect(a).not.toBe(b);
  });
});

describe("profile photo", () => {
  test("only the staff have one; it must be an https photo address; null clears it", async () => {
    const { service, users } = setup();
    const editor: AuthUser = { ...alice, role: "editor" };
    users.set(alice.id, editor);
    expect(await service.update(editor, { avatarUrl: "https://example.com/me.jpg" })).toMatchObject({ ok: true, profile: { avatarUrl: "https://example.com/me.jpg" } });
    expect(await service.update(editor, { avatarUrl: "http://example.com/me.jpg" })).toEqual({ ok: false, reason: "invalid_photo_url" });
    expect(await service.update(editor, { avatarUrl: null })).toMatchObject({ ok: true, profile: { avatarUrl: null } });
    expect(await service.update(alice, { avatarUrl: "https://example.com/me.jpg" })).toEqual({ ok: false, reason: "forbidden" });
  });
});
