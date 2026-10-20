import type { TObject, TOptional, TProperties } from "@sinclair/typebox";
import { Elysia, t } from "elysia";
import { fail } from "../auth/http";
import { can, type Permission } from "../auth/permissions";
import { routeKit, type KitServices, type RouteOptions } from "../auth/route-kit";
import type { ErrorCode } from "../lib/api-errors";
import { CURSOR_PATTERN, type ListReader, type ListService } from "./list-service";
import type { ListMeta, ListRow, ListUi } from "./list-types";

/**
 * One admin list, described once: where it lives (`/admin/lists/<key>`), who may use it, the fields an admin may
 * write (TypeBox, so bodies are validated before anything runs), which service holds it, what an admin may do with
 * it, and how its screens look (`ui`: the web app draws the menu, list and form from this alone).
 */
export interface ReadDef<K extends string, R extends ListRow, S> {
  key: K;
  permission: Permission;
  service: (services: S) => ListReader<R>;
  ops: ListMeta["ops"];
  ui: ListUi;
}

/** A list an admin can also write (create / change / delete through listWriteRoutes). */
export interface ListDef<K extends string, P extends TProperties, R extends ListRow, S> extends ReadDef<K, R, S> {
  fields: P;
  service: (services: S) => ListService<R, Fields<P>>;
}

// shortcut: inside these generic factories TypeScript cannot resolve a TypeBox body type, so bodies are cast to the
// fields at this one boundary. The schemas still validate every request, and the typed client (Eden) sees the
// concrete types wherever a list is mounted.
type Fields<P extends TProperties> = TObject<P>["static"];

/** Times as ISO text, so the editor can send `updatedAt` back exactly as it got it. */
export const rowOut = <R extends ListRow>(r: R) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() });

function statusOf(reason: ErrorCode): 400 | 404 | 409 | 422 {
  switch (reason) {
    case "not_found":
      return 404;
    case "validation_failed":
      return 422;
    case "conflict":
      return 409;
    default:
      return 400; // a field the table's rules refused
  }
}

const idParams = t.Object({ id: t.String({ format: "uuid" }) });

/** Read a list: a page (newest first, `?cursor=` for the next one) and one row. */
export function listReadRoutes<K extends string, R extends ListRow, S extends KitServices>(
  def: ReadDef<K, R, S>,
  getServices: () => S,
  opts: RouteOptions,
) {
  const { plugins } = routeKit(getServices, opts);
  const svc = () => def.service(getServices());
  return new Elysia({ prefix: `/admin/lists/${def.key}` as `/admin/lists/${K}`, detail: { tags: ["Admin lists"] } })
    .use(plugins)
    .get(
      "/",
      async ({ query }) => {
        const page = await svc().list(query.cursor);
        return { ok: true as const, items: page.items.map(rowOut), next: page.next };
      },
      { auth: def.permission, query: t.Object({ cursor: t.Optional(t.String({ pattern: CURSOR_PATTERN })) }) },
    )
    .get(
      "/:id",
      async ({ params, set }) => {
        const row = await svc().get(params.id);
        return row ? { ok: true as const, item: rowOut(row) } : fail(set, 404, "not_found");
      },
      { auth: def.permission, params: idParams },
    );
}

/**
 * Write a list: create (every field), change (the fields that change, plus the `updatedAt` the editor loaded; 409
 * `conflict` when someone saved first) and delete. Rate limited like every admin write; the store audits.
 */
export function listWriteRoutes<K extends string, P extends TProperties, R extends ListRow, S extends KitServices>(
  def: ListDef<K, P, R, S>,
  getServices: () => S,
  opts: RouteOptions,
) {
  const { plugins } = routeKit(getServices, opts);
  const svc = () => def.service(getServices());
  const fields = t.Object(def.fields);
  // Every field optional (only what changes is sent), plus the `updatedAt` the editor loaded.
  const optional = Object.fromEntries(Object.entries(def.fields).map(([k, v]) => [k, t.Optional(v)])) as { [Key in keyof P]: TOptional<P[Key]> };
  const changes = t.Object({ updatedAt: t.String({ format: "date-time" }), ...optional });
  return new Elysia({ prefix: `/admin/lists/${def.key}` as `/admin/lists/${K}`, detail: { tags: ["Admin lists"] } })
    .use(plugins)
    .post(
      "/",
      async ({ user, body, set }) => {
        const r = await svc().create(user.id, body as Fields<P>);
        if (!r.ok) return fail(set, statusOf(r.reason), r.reason);
        set.status = 201;
        return { ok: true as const, item: rowOut(r.value) };
      },
      { auth: def.permission, rateLimit: { adminWriteUser: "user.id" }, body: fields },
    )
    .patch(
      "/:id",
      async ({ user, params, body, set }) => {
        const { updatedAt, ...changes } = body as unknown as { updatedAt: string } & Record<string, unknown>;
        const r = await svc().update(user.id, params.id, updatedAt, changes as Partial<Fields<P>>);
        return r.ok ? { ok: true as const, item: rowOut(r.value) } : fail(set, statusOf(r.reason), r.reason);
      },
      {
        auth: def.permission,
        rateLimit: { adminWriteUser: "user.id" },
        params: idParams,
        body: changes,
      },
    )
    .delete(
      "/:id",
      async ({ user, params, set }) => {
        const r = await svc().remove(user.id, params.id);
        return r.ok ? { ok: true as const } : fail(set, statusOf(r.reason), r.reason);
      },
      { auth: def.permission, rateLimit: { adminWriteUser: "user.id" }, params: idParams },
    );
}

/**
 * GET /admin/lists: how to draw every list this account may use (the web app's menu, list pages and forms). Any
 * logged-in account may ask; a participant gets an empty list. It holds labels and field kinds, never data.
 */
export function listMetaRoutes<S extends KitServices>(defs: readonly Pick<ReadDef<string, ListRow, S>, "key" | "permission" | "ops" | "ui">[], getServices: () => S, opts: RouteOptions) {
  const { plugins } = routeKit(getServices, opts);
  return new Elysia({ prefix: "/admin/lists", detail: { tags: ["Admin lists"] } })
    .use(plugins)
    .get(
      "/",
      ({ user }) => ({
        ok: true as const,
        lists: defs.filter((d) => can(user.role, d.permission)).map((d): ListMeta => ({ key: d.key, ops: d.ops, ...d.ui })),
      }),
      { auth: "me.manage" },
    );
}
