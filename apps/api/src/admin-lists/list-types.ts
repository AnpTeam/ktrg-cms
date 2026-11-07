// The generic admin list ("describe a table once, get its admin"): a list is a table of rows an admin can page
// through, open, and (for a writable list) create, change and delete. Each table brings its own store (Drizzle, plus
// the in-memory twin) and its own rules; list-routes.ts turns them into the same HTTP endpoints for every table.
import type { AuditAction } from "../audit/audit-log";
import type { ErrorCode } from "../lib/api-errors";

export type Result<T> = { ok: true; value: T } | { ok: false; reason: ErrorCode };
export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const bad = (reason: ErrorCode): Result<never> => ({ ok: false, reason });

/** What every row has: an id, and the two times (the editor sends `updatedAt` back to detect a newer save). */
export interface ListRow {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Where the next page starts: just after this row, newest first. */
export interface Cursor {
  createdAt: Date;
  id: string;
}

/** The audit actions a writable list records (ids only, in the same transaction as the change). */
export interface ListAudit {
  create: AuditAction;
  update: AuditAction;
  delete: AuditAction;
}

/**
 * Storage for one list. Every change takes the acting admin and writes its own audit row. A change carries the
 * `updatedAt` the editor loaded: a different value is a conflict.
 */
export interface ListReadStore<R extends ListRow> {
  /** Newest first, starting after `after`, at most `limit` rows. */
  list(after: Cursor | null, limit: number): Promise<R[]>;
  get(id: string): Promise<R | null>;
}

/** Storage for a list an admin can also write. */
export interface ListStore<R extends ListRow, F> extends ListReadStore<R> {
  create(actor: string, fields: F): Promise<R>;
  update(actor: string, id: string, expected: Date, changes: Partial<F>): Promise<R | "conflict" | null>;
  remove(actor: string, id: string): Promise<boolean>;
}

// ---- How the admin screens draw a list (sent to the web app by GET /admin/lists) --------------------------------
// The web app has no code per table: the menu, the list page and the form are drawn from this. Admin labels are the
// one place the API sends words to show (CLAUDE.md allows it for admin labels only), always in both languages.

export type Label = { ja: string; en: string };

/** How a chip in the list is coloured (and marked, so colour is never the only cue): good, warn and bad are for a state. */
export type Tone = "neutral" | "good" | "warn" | "bad" | "info";

/**
 * - bilingual / bilingual-long: Japanese and English side by side (`<name>Ja`, `<name>En`); one line / several lines
 * - text: one line of plain text
 * - url: an https link
 * - image: an https link to a photo, with an upload button and a preview
 * - number: a whole number
 * - decimal: a number with a fraction (a latitude), or empty (null)
 * - date: a day (YYYY-MM-DD); with `optional`, empty is sent as null
 * - datetime: a moment (ISO text), shown in Japan time; read only
 * - boolean: a tick box
 * - select: one of `options`
 * - hours: weekly opening hours (`openingHours`, a JSON object: seven days of periods and a note); the form draws a table
 * - route: one of the routes, or none (null)
 * - relation: one row of another list (`to`: that list's key), or none (null). Stored as its id; the list's own rules check
 *   that the row exists, as they do for a route. `route` is the same thing aimed at the routes.
 */
export type FieldKind = "bilingual" | "bilingual-long" | "text" | "url" | "image" | "number" | "decimal" | "date" | "datetime" | "boolean" | "select" | "route" | "relation" | "hours";

export interface FieldUi {
  /** The API field; for a bilingual field the stem ("title" → titleJa / titleEn). */
  name: string;
  kind: FieldKind;
  label: Label;
  hint?: Label;
  /** Must be filled in (Japanese, for a bilingual field). */
  required?: boolean;
  /** A date that may be left empty. */
  optional?: boolean;
  /** For a relation field: the key of the list it points at. */
  to?: string;
  /** For a route or relation field: what "none" means. */
  noneLabel?: Label;
  /** For a select field: the values it offers. */
  options?: { value: string; label: Label; tone?: Tone }[];
  /** Shown on the form but never sent (the API does not take it). */
  readOnly?: boolean;
  /** Goes in the form's side panel, beside the writing (below it on a narrow screen). */
  side?: boolean;
  /**
   * Shown in the list's line of facts under each row's name. `text` wraps the value ("{value}" is replaced; a day is
   * written out, a route by its name); `empty` is shown when there is no value; a boolean shows `yes` or `no`.
   */
  inList?: { text?: Label; empty?: Label; yes?: Label; no?: Label; tone?: { yes?: Tone; no?: Tone } };
}

export interface ListUi {
  title: Label;
  intro: Label;
  /** The "new" button and page (a list that can create). */
  newLabel?: Label;
  /** Asked before deleting (a list that can delete). */
  deleteWarning?: Label;
  /** The field that names a row in the list (a bilingual or a text field). */
  titleField: string;
  /** Fields tried in this order for the name shown in the list; `titleField` is the last resort (a member's name, else email, else ID). */
  titleFrom?: string[];
  fields: FieldUi[];
  /**
   * Where a row in the list leads, under /<locale>/admin/, when not to its own form: "{name}" is replaced by the
   * row's field (a place opens in its route's editor: "routes/{routeId}").
   */
  linkTo?: string;
}

/** One list as GET /admin/lists describes it to the web app. */
export interface ListMeta extends ListUi {
  key: string;
  ops: { create: boolean; edit: boolean; delete: boolean };
}

/**
 * What an `afterWrite` hook is told after a change is saved: what happened, who did it, which row, and the row as saved
 * (null after a delete, which only returns whether a row was there).
 */
export interface ListEvent<R> {
  type: "create" | "update" | "delete";
  actor: string;
  id: string;
  row: R | null;
}

/**
 * Code a list runs after each saved change (clear a cache, tell someone, update a copy). It runs once the change is
 * already saved, so a hook that throws is logged and never undoes or fails the save.
 */
export type ListHook<R> = (event: ListEvent<R>) => void | Promise<void>;

/**
 * The table's own rules, run before every write. Gets the whole new row on create, and the saved row with the changes
 * on top on update; returns it cleaned (trimmed, blank English as null) or the reason it is refused.
 */
export type ListRules<F> = (fields: Partial<F>, mode: "create" | "update") => Promise<Result<Partial<F>>>;
