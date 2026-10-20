import { notFound } from "next/navigation";
import { cache } from "react";
import { adminGet } from "../admin-fetch";
import type { AdminRouteSummary } from "../types";
import type { ListMeta } from "./config";

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

/** The routes a route field offers (only fetched when the list has one), named in the page's language. */
export async function routeChoices(meta: ListMeta, locale: string): Promise<{ id: string; name: string }[]> {
  if (!meta.fields.some((f) => f.kind === "route")) return [];
  const { status, body } = await adminGet<{ ok: true; routes: AdminRouteSummary[] }>("/routes");
  const routes = status === 200 && body?.ok ? body.routes : [];
  return routes.map((r) => ({ id: r.id, name: locale === "en" && r.nameEn ? r.nameEn : r.nameJa }));
}
