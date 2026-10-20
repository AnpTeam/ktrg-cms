import { errorKeyFromApi, isServerCode, type ErrorKey } from "../../api-error";
import type { ListItem } from "./config";

// The browser side of /api/v1/admin/lists/<key>. Same answers as admin-client.ts's `outcome()`: `{ ok: true, data }`
// or `{ ok: false, key }` naming the sentence to show; it never throws ("network" when there is no signal).
// shortcut: plain fetch with untyped bodies, because the generic screens only know the list key at run time (Eden
// types each list separately). The API schemas still validate every field; switch to Eden if a list needs its types.

export type ListAnswer<T> = { ok: true; data: T } | { ok: false; key: ErrorKey };

export async function listRequest<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<ListAnswer<T>> {
  try {
    const res = await fetch(`/api/v1/admin/lists/${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown } | null;
    if (res.ok && json?.ok === true) return { ok: true, data: json as T };
    if (json?.ok === false && isServerCode(json.error)) return { ok: false, key: json.error };
    return { ok: false, key: errorKeyFromApi(res.status, json) };
  } catch {
    return { ok: false, key: "network" };
  }
}

export type ListPage = { items: ListItem[]; next: string | null };
export type OneItem = { item: ListItem };
