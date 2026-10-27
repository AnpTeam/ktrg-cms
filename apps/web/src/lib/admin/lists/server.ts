import { notFound } from "next/navigation";
import { cache } from "react";
import { adminGet } from "../admin-fetch";
import type { AdminRouteSummary } from "../types";
import { itemName, MAX_RELATION_CHOICES, type ListMeta } from "./config";
import type { ListPage } from "./list-client";

// Server side of the generic admin pages and menu. Server code only (it forwards the admin's cookie).

/** Every list this admin may use, as the API describes them; null when the API did not answer. Once per request. */
export const adminLists = cache(async (): Promise<ListMeta[] | null> => {
  const { status, body } = await adminGet<{ ok: true; lists: ListMeta[] }>("/lists");
  return status === 200 && body?.ok ? body.lists : null;
});

/** One list's description, or the 404 page for a key the API does not offer. */
export async function listMetaOr404(key: string): Promise<ListMeta> {
  const meta = (await adminLists())?.find((l) => l.key === key);
  if (!meta) notFound();
  return meta;
}

/** A row a relation field offers: its name, and a second line that tells same-named rows apart (the route it is on). */
export type Choice = { id: string; name: string; detail?: string };

// shortcut: a relation field offers at most this many rows of the other list (read 50 at a time); a list with more
// than that needs a search-as-you-type picker instead.

/**
 * The rows each relation field of a list offers, by field name, named in the page's language: a `route` field offers the
 * routes, a `relation` field the rows of the list it points at. Only fetched when the list has such a field.
 */
export async function relationChoices(meta: ListMeta, locale: string): Promise<Record<string, Choice[]>> {
  const targets = new Map<string, Choice[]>();
  const out: Record<string, Choice[]> = {};
  for (const f of meta.fields) {
    const target = f.kind === "route" ? "routes" : f.kind === "relation" ? f.to : undefined;
    if (!target) continue;
    if (!targets.has(target)) targets.set(target, await choicesOf(target, locale));
    out[f.name] = targets.get(target)!;
  }
  return out;
}

async function choicesOf(target: string, locale: string): Promise<Choice[]> {
  if (target === "routes") {
    const { status, body } = await adminGet<{ ok: true; routes: AdminRouteSummary[] }>("/routes");
    const routes = status === 200 && body?.ok ? body.routes : [];
    return routes.map((r) => ({ id: r.id, name: locale === "en" && r.nameEn ? r.nameEn : r.nameJa }));
  }
  const meta = (await adminLists())?.find((l) => l.key === target);
  if (!meta) return [];
  // Waypoints and places on a route say which one, so two "公衆トイレ" can be told apart.
  const routeNames = meta.fields.some((f) => f.name === "routeId") ? new Map((await choicesOf("routes", locale)).map((r) => [r.id, r.name])) : null;
  const out: Choice[] = [];
  let cursor: string | null = null;
  do {
    const { status, body }: { status: number; body: ({ ok: true } & ListPage) | null } = await adminGet(`/lists/${target}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (status !== 200 || !body?.ok) break;
    out.push(
      ...body.items.map((item) => {
        const route = routeNames && typeof item.routeId === "string" ? routeNames.get(item.routeId) : undefined;
        return { id: item.id, name: itemName(meta, item, locale), ...(route ? { detail: route } : {}) };
      }),
    );
    cursor = body.next;
  } while (cursor && out.length < MAX_RELATION_CHOICES);
  return out;
}
