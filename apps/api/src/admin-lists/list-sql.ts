import { desc, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { Cursor } from "./list-types";

// Newest first, page after page, the same way for every Drizzle list store. The database keeps microseconds and a
// JavaScript Date milliseconds, so rows are compared and ordered at millisecond precision, with the id breaking ties.

export function newestFirst(createdAt: PgColumn, id: PgColumn): SQL[] {
  return [desc(sql`date_trunc('milliseconds', ${createdAt})`), desc(id)];
}

/** The row's updatedAt is the one the editor loaded (the check that nobody saved first). */
export function sameInstant(updatedAt: PgColumn, expected: Date): SQL {
  return sql`date_trunc('milliseconds', ${updatedAt}) = ${expected.toISOString()}::timestamptz`;
}

/** Rows after the cursor (older), or no condition on the first page. */
export function afterCursor(createdAt: PgColumn, id: PgColumn, cursor: Cursor | null): SQL | undefined {
  if (!cursor) return undefined;
  return sql`(date_trunc('milliseconds', ${createdAt}), ${id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`;
}
