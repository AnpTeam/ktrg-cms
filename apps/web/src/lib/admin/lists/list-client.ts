import { errorKeyFromApi, isServerCode, type ErrorKey } from "../../api-error";
import type { ListItem } from "./config";
import { readJson } from "@/lib/read-json";

// The browser side of /api/v1/admin/lists/<key>. Same answers as admin-client.ts's `outcome()`: `{ ok: true, data }`
// or `{ ok: false, key }` naming the sentence to show; it never throws ("network" when there is no signal).
// shortcut: plain fetch with untyped bodies, because the generic screens only know the list key at run time (Eden
// types each list separately). The API schemas still validate every field; switch to Eden if a list needs its types.

export type ListAnswer<T> = { ok: true; data: T } | { ok: false; key: ErrorKey };

export async function listRequest<T>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown): Promise<ListAnswer<T>> {
  try {
    const res = await fetch(`/api/v1/admin/lists/${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await readJson<{ ok?: unknown; error?: unknown }>(res);
    if (res.ok && json?.ok === true) return { ok: true, data: json as T };
    if (json?.ok === false && isServerCode(json.error)) return { ok: false, key: json.error };
    return { ok: false, key: errorKeyFromApi(res.status, json) };
  } catch {
    return { ok: false, key: "network" };
  }
}

/** One page of a list; `page`, `pages`, `total` and `capped` come with `?page=N` (capped: the list is longer than the API reads). */
export type ListPage = { items: ListItem[]; next: string | null; page?: number; pages?: number; total?: number; capped?: boolean };
export type OneItem = { item: ListItem };
