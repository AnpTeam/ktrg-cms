import type { AuditWriter } from "../audit/audit-log";
import type { ListAudit, ListReadStore, ListRow, ListStore } from "./list-types";

/** Newest first, with the id breaking ties, as the Drizzle stores page (list-sql.ts). */
export function memoryReader<R extends ListRow>(rows: Map<string, R>): ListReadStore<R> {
  const newestFirst = (a: R, b: R) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1);
  return {
    async list(after, limit) {
      return [...rows.values()]
        .sort(newestFirst)
        .filter((r) => !after || r.createdAt.getTime() < after.createdAt.getTime() || (r.createdAt.getTime() === after.createdAt.getTime() && r.id < after.id))
        .slice(0, limit);
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
  };
}

/**
 * The in-memory twin of a list's Drizzle store, for tests and the dev page, for any list whose row is its fields plus
 * id and times. It behaves like the database: newest first with the same cursor, a stale `expected` time is a
 * conflict, every change is audited.
 */
export function createMemoryListStore<F extends object>(audit: AuditWriter, actions: ListAudit, opts: { now?: () => Date } = {}) {
  type R = ListRow & F;
  const now = opts.now ?? (() => new Date());
  const rows = new Map<string, R>();
  let tick = 0;
  // Every write gets a later time than the one before, as the database clock would.
  const stamp = () => new Date(now().getTime() + ++tick);

  const store: ListStore<R, F> = {
    ...memoryReader(rows),
    async create(actor, fields) {
      const at = stamp();
      const row = { ...fields, id: crypto.randomUUID(), createdAt: at, updatedAt: at } as R;
      rows.set(row.id, row);
      await audit.record({ actorUserId: actor, action: actions.create, targetId: row.id });
      return row;
    },
    async update(actor, id, expected, changes) {
      const cur = rows.get(id);
      if (!cur) return null;
      if (cur.updatedAt.getTime() !== expected.getTime()) return "conflict";
      const defined = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
      const row = { ...cur, ...defined, updatedAt: stamp() } as R;
      rows.set(id, row);
      await audit.record({ actorUserId: actor, action: actions.update, targetId: id });
      return row;
    },
    async remove(actor, id) {
      if (!rows.delete(id)) return false;
      await audit.record({ actorUserId: actor, action: actions.delete, targetId: id });
      return true;
    },
  };
  return { store, rows };
}
