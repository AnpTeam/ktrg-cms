// Server side: read from the admin API as the signed-in admin. The session cookie is forwarded from the page request
// (it is HttpOnly, so only the server can). Changes are sent from the browser through the typed client instead.

import { headers } from "next/headers";
import { readJson } from "@/lib/read-json";

export const adminGet = <T>(path: string) => apiGet<T>(`/admin${path}`);

export async function apiGet<T>(path: string): Promise<{ status: number; body: T | null }> {
  const cookie = (await headers()).get("cookie") ?? "";
  try {
    const res = await fetch(`${process.env.API_ORIGIN ?? "http://localhost:3001"}/api/v1${path}`, {
      headers: { cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return { status: res.status, body: await readJson<T>(res) };
  } catch {
    return { status: 0, body: null }; // the API is not reachable
  }
}
