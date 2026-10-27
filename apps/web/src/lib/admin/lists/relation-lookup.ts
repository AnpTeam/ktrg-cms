import { itemName, type ListItem, type ListMeta } from "./config";
import { listRequest, type ListPage, type OneItem } from "./list-client";

// What the relation picker asks the API for once the list is longer than what the page loaded: a search by name, and one
// row by id (the chosen one may be past the loaded rows). Browser side; the answers are cached for the life of the page.

export type RelationChoice = { id: string; name: string; detail?: string };

/** A row of a list as a choice: its name in the page's language, and the route it is on (so same-named rows differ). */
export function choiceFromItem(titleField: string, item: ListItem, locale: string, routeNames: ReadonlyMap<string, string> | null): RelationChoice {
  const route = routeNames && typeof item.routeId === "string" ? routeNames.get(item.routeId) : undefined;
  return { id: item.id, name: itemName({ titleField } as ListMeta, item, locale), ...(route ? { detail: route } : {}) };
}

let titles: Promise<Map<string, string> | null> | null = null;
/** The title field of each list, by key (from the lists description); null when it cannot be read. */
function titleFields(): Promise<Map<string, string> | null> {
  titles ??= fetch("/api/v1/admin/lists", { credentials: "same-origin" })
    .then((r) => r.json() as Promise<{ ok?: boolean; lists?: { key: string; titleField: string }[] }>)
    .then((j) => (j.ok && j.lists ? new Map(j.lists.map((l) => [l.key, l.titleField])) : null))
    .catch(() => null);
  return titles;
}

let routes: Promise<Map<string, { ja: string; en: string | null }> | null> | null = null;
function routeNamesBy(): Promise<Map<string, { ja: string; en: string | null }> | null> {
  routes ??= fetch("/api/v1/admin/routes", { credentials: "same-origin" })
    .then((r) => r.json() as Promise<{ ok?: boolean; routes?: { id: string; nameJa: string; nameEn: string | null }[] }>)
    .then((j) => (j.ok && j.routes ? new Map(j.routes.map((r) => [r.id, { ja: r.nameJa, en: r.nameEn }])) : null))
    .catch(() => null);
  return routes;
}

async function context(to: string, locale: string) {
  const [fields, byId] = await Promise.all([titleFields(), routeNamesBy()]);
  const titleField = fields?.get(to);
  if (!titleField) return null;
  const names = byId ? new Map([...byId].map(([id, n]) => [id, locale === "en" && n.en ? n.en : n.ja])) : null;
  return { titleField, names };
}

/** Rows of `to` whose name matches `q` (the API's own search, the first page); null when it could not be asked. */
export async function searchRelation(to: string, q: string, locale: string): Promise<RelationChoice[] | null> {
  const [ctx, found] = await Promise.all([context(to, locale), listRequest<ListPage>("GET", `${to}?q=${encodeURIComponent(q.slice(0, 100))}`)]);
  if (!ctx || !found.ok) return null;
  return found.data.items.map((item) => choiceFromItem(ctx.titleField, item, locale, ctx.names));
}

/** One row of `to` by id; null when it is gone or could not be asked. */
export async function fetchRelation(to: string, id: string, locale: string): Promise<RelationChoice | null> {
  const [ctx, found] = await Promise.all([context(to, locale), listRequest<OneItem>("GET", `${to}/${encodeURIComponent(id)}`)]);
  return ctx && found.ok ? choiceFromItem(ctx.titleField, found.data.item, locale, ctx.names) : null;
}
