import type { AuditWriter } from "../audit/audit-log";
import { createMemoryListStore } from "../admin-lists/list-memory-store";
import type { NoticeFields, NoticeStore } from "./notice-types";

export const NOTICE_AUDIT = { create: "notice.create", update: "notice.update", delete: "notice.delete" } as const;

/** In-memory notices for tests and the dev page; `routes` are the route ids that exist. */
export function createMemoryNoticeStore(audit: AuditWriter, opts: { now?: () => Date; routes?: Iterable<string> } = {}) {
  const list = createMemoryListStore<NoticeFields>(audit, NOTICE_AUDIT, opts);
  const routes = new Set(opts.routes);
  const store: NoticeStore = {
    ...list.store,
    async routeExists(id) {
      return routes.has(id);
    },
    async listPublic(today) {
      return [...list.rows.values()]
        .filter((n) => n.published && (n.expiresOn === null || n.expiresOn >= today))
        .sort((a, b) => Number(b.closure) - Number(a.closure) || b.verifiedOn.localeCompare(a.verifiedOn));
    },
  };
  return { store, rows: list.rows, routes };
}
