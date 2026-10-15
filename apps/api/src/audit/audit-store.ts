import type { Db } from "../db/client";
import { auditLog } from "../db/schema";
import { auditRow, type AuditEntry, type AuditWriter } from "./audit-log";

/** A database or an open transaction: both can insert. */
type Executor = Pick<Db, "insert">;

/**
 * Write one entry with this executor. Pass a transaction (`tx`) when the audit row must
 * commit or roll back together with the change it records, such as a role change.
 */
export async function writeAudit(executor: Executor, entry: AuditEntry): Promise<void> {
  await executor.insert(auditLog).values(auditRow(entry));
}

export function createDrizzleAuditWriter(db: Db): AuditWriter {
  return {
    record: (entry) => writeAudit(db, entry),
  };
}
