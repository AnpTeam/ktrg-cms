import { auditLog } from "../db/schema";

/**
 * THE list of audited actions and the kind of thing each one acts on.
 *
 * - A new audited action must be added here first (it is type checked).
 * - An entry stores ids only: who did it (a user id) and what it was done to (a row id).
 *   Never an email, name, IP, label or free text: the audit log keeps rows for good,
 *   even after the account is deleted, so it must not hold personal data.
 */
export const AUDIT_ACTIONS = {
  /** ADMIN_EMAILS made this account an admin on an email-code login. */
  "user.role.bootstrap_admin": "user",
  /** A fresh-login re-check passed (needed before role changes). */
  "session.reauth": "user",
  "passkey.add": "passkey",
  "passkey.remove": "passkey",
  /** DELETE /me: the owner asked for their account to be deleted. */
  "user.deletion_request": "user",
  /** The owner cancelled a pending deletion request. */
  "user.deletion_cancel": "user",
  /** The grace period ended and the account and its data were deleted (done by the purge script, so no actor). */
  "user.deleted": "user",
  /** Admin content: routes (an order change has no single target). */
  "route.create": "route",
  "route.update": "route",
  "route.delete": "route",
  "route.reorder": "route",
  /** Admin content: stamp places. A reorder is recorded against the route it happened in. */
  "spot.create": "spot",
  "spot.update": "spot",
  "spot.delete": "spot",
  "spot.publish": "spot",
  "spot.unpublish": "spot",
  "spot.status.change": "spot",
  "spot.reorder": "route",
  /** An admin uploaded a photo (the target is the file's UUID in storage). */
  "upload.create": "upload",
} as const satisfies Record<string, string>;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export interface AuditEntry {
  /** The account that did it. Null only for the system itself (no account). */
  actorUserId: string | null;
  action: AuditAction;
  /** The id of the row it was done to, or null when the action has no single target. */
  targetId: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check an entry and turn it into an audit_log row. Throws on anything but a known action
 * and UUID ids, so an email or a name can never be written, even by mistake.
 */
export function auditRow(entry: AuditEntry): typeof auditLog.$inferInsert {
  if (!Object.hasOwn(AUDIT_ACTIONS, entry.action)) throw new Error(`audit: unknown action "${entry.action}"`);
  for (const [field, id] of [["actorUserId", entry.actorUserId], ["targetId", entry.targetId]] as const) {
    // Say which field was wrong, never echo the value: it might be the PII we are refusing.
    if (id !== null && !UUID.test(id)) throw new Error(`audit: ${field} must be a UUID (ids only, no personal data)`);
  }
  return {
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: AUDIT_ACTIONS[entry.action],
    targetId: entry.targetId,
  };
}

/** Writes audit entries. The Drizzle version is in audit-store.ts, an in-memory one below. */
export interface AuditWriter {
  record(entry: AuditEntry): Promise<void>;
}

/** In-memory writer for tests: applies the same checks, keeps the rows. */
export function createMemoryAuditWriter() {
  const rows: (typeof auditLog.$inferInsert)[] = [];
  const writer: AuditWriter = {
    async record(entry) {
      rows.push(auditRow(entry));
    },
  };
  return { writer, rows };
}
