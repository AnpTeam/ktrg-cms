import { bad, ok, type Cursor, type ListReadStore, type ListRow, type ListRules, type ListStore, type Result } from "./list-types";

export const PAGE_SIZE = 50;

/** A page cursor as text: the last row's createdAt (ISO) and id, joined by "_". */
export const CURSOR_PATTERN = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z_[0-9a-fA-F-]{36}$";

export function cursorText(row: Pick<ListRow, "createdAt" | "id">): string {
  return `${row.createdAt.toISOString()}_${row.id}`;
}

/** null for no cursor or one that does not read as a time and an id (the route schema has already checked its shape). */
export function parseCursor(text: string | undefined): Cursor | null {
  if (!text) return null;
  const [time, id] = text.split("_");
  const createdAt = new Date(time ?? "");
  return Number.isNaN(createdAt.getTime()) || !id ? null : { createdAt, id };
}

export type ListReader<R extends ListRow> = ReturnType<typeof createListReader<R>>;
export type ListService<R extends ListRow, F> = ReturnType<typeof createListService<R, F>>;

/** Reading any list: pages of 50, newest first, and one row. */
export function createListReader<R extends ListRow>(deps: { store: ListReadStore<R>; pageSize?: number }) {
  const { store } = deps;
  const size = deps.pageSize ?? PAGE_SIZE;
  return {
    /** One page, and the cursor of the next one (null on the last page). */
    async list(cursor?: string): Promise<{ items: R[]; next: string | null }> {
      const rows = await store.list(parseCursor(cursor), size + 1);
      const items = rows.slice(0, size);
      return { items, next: rows.length > size ? cursorText(items[items.length - 1]!) : null };
    },
    get: (id: string) => store.get(id),
  };
}

/** A list an admin can also write: the table's rules before each write; conflicts reported. */
export function createListService<R extends ListRow, F>(deps: { store: ListStore<R, F>; rules: ListRules<F>; pageSize?: number }) {
  const { store, rules } = deps;
  const done = (r: R | "conflict" | null): Result<R> => (r === null ? bad("not_found") : r === "conflict" ? bad("conflict") : ok(r));

  return {
    ...createListReader(deps),

    async create(actor: string, input: F): Promise<Result<R>> {
      const checked = await rules(input, "create");
      return checked.ok ? ok(await store.create(actor, checked.value as F)) : checked;
    },

    async update(actor: string, id: string, expected: Date | string, input: Partial<F>): Promise<Result<R>> {
      // The rules see the whole row as it would be (a rule can compare two fields, only one of which changed);
      // only the changed fields are saved.
      const current = await store.get(id);
      if (!current) return bad("not_found");
      const checked = await rules({ ...current, ...input } as Partial<F>, "update");
      if (!checked.ok) return checked;
      const cleaned = checked.value as Record<string, unknown>;
      const changes = Object.fromEntries(Object.keys(input).map((k) => [k, cleaned[k]])) as Partial<F>;
      return done(await store.update(actor, id, expected instanceof Date ? expected : new Date(expected), changes));
    },

    async remove(actor: string, id: string): Promise<Result<true>> {
      return (await store.remove(actor, id)) ? ok(true) : bad("not_found");
    },
  };
}
